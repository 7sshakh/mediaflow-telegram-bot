import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/cache/redisClient", () => ({ getRedis: () => null }));

import { checkAndConsumeRateLimit } from "@/services/ratelimit/limiter";

describe("in-memory rate limiter", () => {
  it("allows requests under the per-minute threshold", async () => {
    const userId = Math.floor(Math.random() * 1_000_000);
    const result = await checkAndConsumeRateLimit(userId);
    expect(result.allowed).toBe(true);
  });

  it("blocks requests once the per-minute threshold is exceeded", async () => {
    const userId = Math.floor(Math.random() * 1_000_000) + 2_000_000;
    let lastResult;
    for (let i = 0; i < 15; i++) {
      lastResult = await checkAndConsumeRateLimit(userId);
    }
    expect(lastResult?.allowed).toBe(false);
    expect(lastResult?.reason).toBe("PER_MINUTE");
  });
});
