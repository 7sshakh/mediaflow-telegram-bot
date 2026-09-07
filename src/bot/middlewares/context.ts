import type { NextFunction } from "grammy";
import { getOrCreateUser, normalizeLocale } from "@/db/repo/users";
import { logger } from "@/core/logger";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";

/** Loads/creates the DB user, resolves locale, and blocks banned users. */
export async function userContextMiddleware(ctx: BotContext, next: NextFunction) {
  const from = ctx.from;
  if (!from) return next();

  try {
    const dbUser = await getOrCreateUser({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      languageCode: from.language_code,
    });

    if (dbUser.isBlocked) {
      const locale = normalizeLocale(dbUser.languageCode);
      await ctx.reply(t(locale, "error_blocked")).catch(() => undefined);
      return; // do not call next() — stop the chain for blocked users
    }

    ctx.dbUser = dbUser;
    ctx.locale = normalizeLocale(dbUser.languageCode);
  } catch (err) {
    logger.error({ err: String(err) }, "user_context_middleware_failed");
  }

  return next();
}

export async function errorBoundaryMiddleware(ctx: BotContext, next: NextFunction) {
  try {
    await next();
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.stack : String(err) }, "handler_error");
    try {
      await ctx.reply("❌ Unexpected error. Please try again later.");
    } catch {
      /* ignore secondary failures */
    }
  }
}
