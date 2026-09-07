import { getRedis } from "@/services/cache/redisClient";
import { config } from "@/core/config";

/**
 * Per-user anti-abuse rate limiting:
 *  - sliding requests-per-minute window
 *  - daily download cap
 *  - concurrent download cap (see services/queue/taskQueue.ts + DB task counts)
 *
 * Uses Redis INCR/EXPIRE when available for correctness across multiple
 * processes; falls back to an in-memory counter for single-process/dev use.
 */

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

async function incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedis();
  if (redis) {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds, "NX");
    const results = await multi.exec();
    const count = (results?.[0]?.[1] as number) ?? 1;
    return count;
  }

  const now = Date.now();
  const entry = memoryCounters.get(key);
  if (!entry || entry.resetAt < now) {
    memoryCounters.set(key, { count: 1, resetAt: now + ttlSeconds * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: "PER_MINUTE" | "PER_DAY";
  retryAfterSeconds?: number;
}

export async function checkAndConsumeRateLimit(telegramId: number): Promise<RateLimitCheck> {
  const minuteKey = `rl:min:${telegramId}:${Math.floor(Date.now() / 60_000)}`;
  const dayKey = `rl:day:${telegramId}:${new Date().toISOString().slice(0, 10)}`;

  const minuteCount = await incrWithTtl(minuteKey, 60);
  if (minuteCount > config.limits.maxRequestsPerMinute) {
    return { allowed: false, reason: "PER_MINUTE", retryAfterSeconds: 60 };
  }

  const dayCount = await incrWithTtl(dayKey, 24 * 60 * 60);
  if (dayCount > config.limits.maxDownloadsPerDay) {
    return { allowed: false, reason: "PER_DAY" };
  }

  return { allowed: true };
}
