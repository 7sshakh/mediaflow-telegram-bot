import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createTaskDir, removeDir, findLargestMediaFile } from "@/services/storage/tempStorage";
import { config } from "@/core/config";

describe("tempStorage", () => {
  beforeAll(async () => {
    await fs.mkdir(config.storage.tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(config.storage.tempDir, { recursive: true, force: true });
  });

  it("creates an isolated per-task directory", async () => {
    const { dir, id } = await createTaskDir();
    expect(dir).toContain(id);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
    await removeDir(dir);
  });

  it("refuses to remove directories outside of the configured temp root", async () => {
    const outside = path.join("/tmp", "definitely-not-mediaflow-" + Date.now());
    await fs.mkdir(outside, { recursive: true });
    await removeDir(outside);
    const stillExists = await fs
      .stat(outside)
      .then(() => true)
      .catch(() => false);
    expect(stillExists).toBe(true);
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("finds the largest non-metadata media file in a directory", async () => {
    const { dir } = await createTaskDir();
    await fs.writeFile(path.join(dir, "meta.info.json"), "{}");
    await fs.writeFile(path.join(dir, "small.mp4"), Buffer.alloc(10));
    await fs.writeFile(path.join(dir, "big.mp4"), Buffer.alloc(1000));
    const largest = await findLargestMediaFile(dir);
    expect(largest).toBe(path.join(dir, "big.mp4"));
    await removeDir(dir);
  });
});
