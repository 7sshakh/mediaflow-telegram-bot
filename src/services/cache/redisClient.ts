import Redis from "ioredis";
import { config } from "@/core/config";
import { logger } from "@/core/logger";

/**
 * Optional Redis client. When REDIS_URL is not configured the application
 * transparently falls back to in-memory caching/rate-limiting (see
 * services/cache/cache.ts and services/ratelimit/limiter.ts), which is
 * perfectly fine for a single-process deployment and keeps local/dev setup
 * dependency-free while remaining Redis-ready for horizontal scaling.
 */
let client: Redis | null = null;
let attempted = false;

export function getRedis(): Redis | null {
  if (!config.redis.url) return null;
  if (attempted) return client;
  attempted = true;
  try {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: false,
    });
    client.on("error", (err) => {
      logger.warn({ err: err.message }, "redis_error_falling_back_to_memory");
    });
  } catch (err) {
    logger.warn({ err: String(err) }, "redis_init_failed");
    client = null;
  }
  return client;
}
