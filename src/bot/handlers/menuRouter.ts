import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { decodeCallback } from "@/bot/utils/callbackData";
import { mainMenuKeyboard, backToMenuKeyboard } from "@/bot/keyboards/keyboards";
import { showHistory } from "./history";
import { showSettings } from "./settings";

/** Handles the "menu" callback family (main menu navigation). */
export function registerMenuRouter(bot: Bot<BotContext>) {
  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded || decoded.action !== "menu") return next();

    const [target] = decoded.parts;
    await ctx.answerCallbackQuery();

    switch (target) {
      case "root":
        await ctx.editMessageText(t(ctx.locale, "start_welcome"), {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(ctx.locale),
        }).catch(() => ctx.reply(t(ctx.locale, "start_welcome"), { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx.locale) }));
        return;
      case "download":
        await ctx.reply(t(ctx.locale, "ask_for_link"), { reply_markup: backToMenuKeyboard(ctx.locale) });
        return;
      case "music":
        ctx.session.awaitingMusicQuery = true;
        await ctx.reply(t(ctx.locale, "ask_for_music_query"), { reply_markup: backToMenuKeyboard(ctx.locale) });
        return;
      case "history":
        await showHistory(ctx);
        return;
      case "settings":
        await showSettings(ctx);
        return;
      case "help":
        await ctx.reply(t(ctx.locale, "help_text"), {
          parse_mode: "HTML",
          reply_markup: backToMenuKeyboard(ctx.locale),
        });
        return;
      default:
        return next();
    }
  });

  bot.callbackQuery(/^noop~.*/, async (ctx) => ctx.answerCallbackQuery());
}
