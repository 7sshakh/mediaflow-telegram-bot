import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import {
  settingsKeyboard,
  languageKeyboard,
  audioQualityKeyboard,
  videoQualityKeyboard,
} from "@/bot/keyboards/keyboards";
import { decodeCallback } from "@/bot/utils/callbackData";
import { setUserLanguage, updateUserSettings, normalizeLocale } from "@/db/repo/users";

export async function showSettings(ctx: BotContext) {
  const text = [
    t(ctx.locale, "settings_title"),
    "",
    `${t(ctx.locale, "settings_language")}: ${ctx.locale.toUpperCase()}`,
    `${t(ctx.locale, "settings_audio_quality")}: ${ctx.dbUser.settings?.audioQuality ?? "192"} kbps`,
    `${t(ctx.locale, "settings_video_quality")}: ${ctx.dbUser.settings?.videoQuality ?? "best"}`,
  ].join("\n");

  const reply_markup = settingsKeyboard(ctx.locale);
  try {
    await ctx.editMessageText(text, { reply_markup });
  } catch {
    await ctx.reply(text, { reply_markup });
  }
}

export function registerSettingsHandlers(bot: Bot<BotContext>) {
  bot.command("settings", showSettings);

  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded) return next();

    if (decoded.action === "settings") {
      await ctx.answerCallbackQuery();
      const [section] = decoded.parts;
      if (section === "lang") {
        await ctx.editMessageText(t(ctx.locale, "lang_choose"), { reply_markup: languageKeyboard() });
      } else if (section === "audio") {
        await ctx.editMessageText(t(ctx.locale, "settings_audio_quality"), { reply_markup: audioQualityKeyboard() });
      } else if (section === "video") {
        await ctx.editMessageText(t(ctx.locale, "settings_video_quality"), { reply_markup: videoQualityKeyboard() });
      }
      return;
    }

    if (decoded.action === "lang_set") {
      const [lang] = decoded.parts;
      const locale = normalizeLocale(lang);
      await setUserLanguage(ctx.dbUser.id, locale);
      ctx.locale = locale;
      await ctx.answerCallbackQuery({ text: t(locale, "lang_saved") });
      await showSettings(ctx);
      return;
    }

    if (decoded.action === "audioq_set") {
      const [value] = decoded.parts;
      await updateUserSettings(ctx.dbUser.id, { audioQuality: value as "128" | "192" | "320" });
      ctx.dbUser.settings = { ...ctx.dbUser.settings, audioQuality: value as "128" | "192" | "320" };
      await ctx.answerCallbackQuery({ text: "✅" });
      await showSettings(ctx);
      return;
    }

    if (decoded.action === "videoq_set") {
      const [value] = decoded.parts;
      await updateUserSettings(ctx.dbUser.id, { videoQuality: value as "best" | "1080" | "720" | "480" });
      ctx.dbUser.settings = { ...ctx.dbUser.settings, videoQuality: value as "best" | "1080" | "720" | "480" };
      await ctx.answerCallbackQuery({ text: "✅" });
      await showSettings(ctx);
      return;
    }

    return next();
  });
}
