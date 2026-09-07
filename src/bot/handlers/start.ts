import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { mainMenuKeyboard } from "@/bot/keyboards/keyboards";

export function registerStartHandlers(bot: Bot<BotContext>) {
  bot.command("start", async (ctx) => {
    await ctx.reply(t(ctx.locale, "start_welcome"), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(ctx.locale),
    });
  });
}
