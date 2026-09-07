import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { extractFirstUrl } from "@/services/security/url";
import { deliverMediaForUrl } from "@/bot/services/deliverMedia";
import { decodeCallback } from "@/bot/utils/callbackData";
import { cancelTask } from "@/services/queue/downloadQueue";
import { getDownload } from "@/db/repo/downloads";
import { registerPendingUrl, resolvePendingUrl } from "@/bot/state/pendingRequests";
import { InlineKeyboard } from "grammy";
import { encodeCallback } from "@/bot/utils/callbackData";
import { handleMusicQueryText } from "./music";

export function registerDownloadHandlers(bot: Bot<BotContext>) {
  // Plain text messages: either a pending "search music by text" flow, or a URL.
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return next();

    if (ctx.session.awaitingMusicQuery) {
      ctx.session.awaitingMusicQuery = false;
      await handleMusicQueryText(ctx, text);
      return;
    }

    const url = extractFirstUrl(text);
    if (!url) {
      await ctx.reply(t(ctx.locale, "ask_for_link"));
      return;
    }

    // YouTube links: ask the user whether they want video or audio.
    if (/youtu\.?be/i.test(new URL(url).hostname)) {
      const id = registerPendingUrl(ctx.dbUser.id, url);
      const kb = new InlineKeyboard()
        .text(t(ctx.locale, "btn_video"), encodeCallback("yt_mode", [id, "video"]))
        .text(t(ctx.locale, "btn_audio"), encodeCallback("yt_mode", [id, "audio"]));
      await ctx.reply(t(ctx.locale, "status_platform_detected", { platform: "YouTube" }), { reply_markup: kb });
      return;
    }

    await deliverMediaForUrl(ctx, url, { mode: ctx.dbUser.settings?.defaultMediaType ?? "video" });
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded) return next();

    if (decoded.action === "yt_mode") {
      const [pendingId, mode] = decoded.parts;
      const url = resolvePendingUrl(pendingId, ctx.dbUser.id);
      await ctx.answerCallbackQuery();
      if (!url) {
        await ctx.reply(t(ctx.locale, "error_generic", { reason: "expired" }));
        return;
      }
      await ctx.deleteMessage().catch(() => undefined);
      await deliverMediaForUrl(ctx, url, { mode: mode === "audio" ? "audio" : "video" });
      return;
    }

    if (decoded.action === "dlagain") {
      const [downloadId, mode] = decoded.parts;
      await ctx.answerCallbackQuery();
      const original = await getDownload(downloadId);
      if (!original || original.userId !== ctx.dbUser.id) return;
      await deliverMediaForUrl(ctx, original.url, { mode: mode === "audio" ? "audio" : "video" });
      return;
    }

    if (decoded.action === "share") {
      const [downloadId] = decoded.parts;
      await ctx.answerCallbackQuery();
      const original = await getDownload(downloadId);
      if (!original || original.userId !== ctx.dbUser.id) return;
      await ctx.reply(`📤 ${original.url}`);
      return;
    }

    if (decoded.action === "cancel") {
      const [taskId] = decoded.parts;
      const ok = cancelTask(taskId);
      await ctx.answerCallbackQuery({ text: ok ? t(ctx.locale, "cancel_confirm") : "—" });
      return;
    }

    if (decoded.action === "music_search_manual") {
      await ctx.answerCallbackQuery();
      ctx.session.awaitingMusicQuery = true;
      await ctx.reply(t(ctx.locale, "ask_for_music_query"));
      return;
    }

    return next();
  });
}
