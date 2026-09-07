import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/core/config";
import { logger } from "@/core/logger";

/**
 * Every task gets its own random temporary directory under TEMP_DIR, e.g.
 * /tmp/mediaflow/{uuid}/. Directories are always cleaned up after use and a
 * background sweep removes anything abandoned beyond the configured TTL.
 */

export async function createTaskDir(): Promise<{ id: string; dir: string }> {
  const id = randomUUID();
  const dir = path.join(config.storage.tempDir, id);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return { id, dir };
}

export async function removeDir(dir: string): Promise<void> {
  try {
    // Guard: only ever remove directories that live inside our temp root.
    const root = path.resolve(config.storage.tempDir);
    const target = path.resolve(dir);
    if (target !== root && !target.startsWith(root + path.sep)) {
      logger.error({ dir }, "refused_to_remove_outside_temp_root");
      return;
    }
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    logger.warn({ dir, err: String(err) }, "temp_dir_cleanup_failed");
  }
}

/** Sweep abandoned task directories older than TEMP_FILE_TTL_MINUTES. */
export async function sweepAbandonedTempDirs(): Promise<number> {
  const root = config.storage.tempDir;
  let removed = 0;
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const ttlMs = config.storage.tempFileTtlMinutes * 60_000;
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(root, entry.name);
      try {
        const stat = await fs.stat(full);
        if (now - stat.mtimeMs > ttlMs) {
          await fs.rm(full, { recursive: true, force: true });
          removed += 1;
        }
      } catch {
        /* ignore races */
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ err: String(err) }, "temp_sweep_failed");
    }
  }
  if (removed > 0) logger.info({ removed }, "temp_sweep_completed");
  return removed;
}

export function startTempCleanupScheduler(intervalMinutes = 10): NodeJS.Timeout {
  return setInterval(() => {
    sweepAbandonedTempDirs().catch((err) => logger.error({ err: String(err) }, "temp_sweep_error"));
  }, intervalMinutes * 60_000);
}

/** Pick the largest media file in a directory (excludes json/part/tmp files). */
export async function findLargestMediaFile(dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let best: { file: string; size: number } | null = null;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/\.(json|part|ytdl|tmp|webp)$/i.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const stat = await fs.stat(full);
    if (!best || stat.size > best.size) best = { file: full, size: stat.size };
  }
  return best?.file ?? null;
}
