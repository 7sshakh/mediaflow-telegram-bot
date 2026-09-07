import { Bot, session } from "grammy";
import { config } from "@/core/config";
import { logger } from "@/core/logger";
import type { BotContext, SessionData } from "./types";
import { userContextMiddleware, errorBoundaryMiddleware } from "./middlewares/context";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import { registerStartHandlers } from "./handlers/start";
import { registerHelpHandlers } from "./handlers/help";
import { registerDownloadHandlers } from "./handlers/download";
import { registerMusicHandlers } from "./handlers/music";
import { registerYoutubeHandlers } from "./handlers/youtube";
import { registerSettingsHandlers } from "./handlers/settings";
import { registerAdminHandlers } from "./handlers/admin";
import { registerHistoryHandlers } from "./handlers/history";
import { registerMenuRouter } from "./handlers/menuRouter";

let botInstance: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (botInstance) return botInstance;
  if (!config.telegram.botToken) {
    throw new Error("BOT_TOKEN is not configured");
  }

  const bot = new Bot<BotContext>(config.telegram.botToken);

  bot.use(errorBoundaryMiddleware);
  bot.use(
    session({
      initial: (): SessionData => ({}),
    }),
  );
  bot.use(userContextMiddleware);
  bot.use(rateLimitMiddleware);

  registerStartHandlers(bot);
  registerHelpHandlers(bot);
  registerSettingsHandlers(bot);
  registerHistoryHandlers(bot);
  registerMusicHandlers(bot);
  registerYoutubeHandlers(bot);
  registerDownloadHandlers(bot);
  registerAdminHandlers(bot);
  registerMenuRouter(bot);

  bot.catch((err) => {
    logger.error({ err: err.message, updateId: err.ctx.update.update_id }, "bot_unhandled_error");
  });

  botInstance = bot;
  return bot;
}
