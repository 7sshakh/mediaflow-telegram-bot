import type { NextFunction } from "grammy";
import { checkAndConsumeRateLimit } from "@/services/ratelimit/limiter";
import { t } from "@/bot/i18n/locales";
import type { BotContext } from "@/bot/types";

/** Applies only to messages that look like a download/search request, not every keystroke. */
export async function rateLimitMiddleware(ctx: BotContext, next: NextFunction) {
  const from = ctx.from;
  if (!from || !ctx.message?.text) return next();

  const result = await checkAndConsumeRateLimit(from.id);
  if (!result.allowed) {
    const key = result.reason === "PER_DAY" ? "error_daily_limit" : "error_rate_limited";
    await ctx.reply(t(ctx.locale ?? "en", key));
    return;
  }
  return next();
}
