import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { backToMenuKeyboard } from "@/bot/keyboards/keyboards";

export function registerHelpHandlers(bot: Bot<BotContext>) {
  bot.command("help", async (ctx) => {
    await ctx.reply(t(ctx.locale, "help_text"), {
      parse_mode: "HTML",
      reply_markup: backToMenuKeyboard(ctx.locale),
    });
  });
}
