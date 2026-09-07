import { db } from "@/db";
import { sql } from "drizzle-orm";
import { config } from "@/core/config";
import { getQueueLength, getActiveCount } from "@/services/queue/downloadQueue";
import { getRedis } from "@/services/cache/redisClient";
import { startTempCleanupScheduler } from "@/services/storage/tempStorage";

export const dynamic = "force-dynamic";

// Start the background temp-file cleanup sweep once per server process.
const globalForScheduler = globalThis as typeof globalThis & { __mediaflowCleanupStarted?: boolean };
if (!globalForScheduler.__mediaflowCleanupStarted) {
  globalForScheduler.__mediaflowCleanupStarted = true;
  startTempCleanupScheduler();
}

export async function GET() {
  const checks: Record<string, boolean | string> = {};
  let healthy = true;

  try {
    await db.execute(sql`select 1`);
    checks.database = true;
  } catch {
    checks.database = false;
    healthy = false;
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = "unreachable (falling back to in-memory)";
    }
  } else {
    checks.redis = "not configured (using in-memory fallback)";
  }

  checks.telegramBotConfigured = Boolean(config.telegram.botToken);
  checks.musicRecognitionConfigured = Boolean(config.music.apiKey);
  checks.queue = `active=${getActiveCount()} queued=${getQueueLength()}`;

  return Response.json({ ok: healthy, checks }, { status: healthy ? 200 : 500 });
}
