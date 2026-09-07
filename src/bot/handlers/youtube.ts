import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { youtubeSearchService } from "@/services/youtube/search";
import { createSearch, getSearch } from "@/db/repo/searches";
import { youtubeResultsKeyboard, youtubeItemKeyboard, backToMenuKeyboard } from "@/bot/keyboards/keyboards";
import { decodeCallback } from "@/bot/utils/callbackData";
import { deliverMediaForUrl } from "@/bot/services/deliverMedia";
import { formatDuration } from "@/utils/format";

export async function searchAndSendYoutube(ctx: BotContext, query: string): Promise<void> {
  const results = await youtubeSearchService.searchMusic(query, 10);
  if (results.length === 0) {
    await ctx.reply(t(ctx.locale, "youtube_no_results"), { reply_markup: backToMenuKeyboard(ctx.locale) });
    return;
  }

  const search = await createSearch(ctx.dbUser.id, query, results);
  await ctx.reply(t(ctx.locale, "youtube_results_title", { query }), {
    reply_markup: youtubeResultsKeyboard(ctx.locale, search.id, results, 0),
  });
}

export function registerYoutubeHandlers(bot: Bot<BotContext>) {
  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded) return next();

    if (decoded.action === "yt_page") {
      const [searchId, pageStr] = decoded.parts;
      const search = await getSearch(searchId);
      await ctx.answerCallbackQuery();
      if (!search || search.userId !== ctx.dbUser.id || !search.resultsJson) return;
      await ctx
        .editMessageReplyMarkup({
          reply_markup: youtubeResultsKeyboard(ctx.locale, searchId, search.resultsJson, Number(pageStr)),
        })
        .catch(() => undefined);
      return;
    }

    if (decoded.action === "yt_item") {
      const [searchId, indexStr] = decoded.parts;
      const search = await getSearch(searchId);
      await ctx.answerCallbackQuery();
      if (!search || search.userId !== ctx.dbUser.id || !search.resultsJson) return;
      const item = search.resultsJson[Number(indexStr)];
      if (!item) return;
      const text = [
        `🎵 <b>${item.title}</b>`,
        `${item.channel} • ${formatDuration(item.duration)}`,
      ].join("\n");
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: youtubeItemKeyboard(ctx.locale, searchId, Number(indexStr), item.url),
      });
      return;
    }

    if (decoded.action === "yt_dl") {
      const [searchId, indexStr, mode] = decoded.parts;
      const search = await getSearch(searchId);
      await ctx.answerCallbackQuery();
      if (!search || search.userId !== ctx.dbUser.id || !search.resultsJson) return;
      const item = search.resultsJson[Number(indexStr)];
      if (!item) return;
      await deliverMediaForUrl(ctx, item.url, { mode: mode === "audio" ? "audio" : "video" });
      return;
    }

    return next();
  });
}
