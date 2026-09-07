import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { backToMenuKeyboard, historyItemKeyboard } from "@/bot/keyboards/keyboards";
import { listRecentDownloadsForUser } from "@/db/repo/downloads";
import { formatDuration, PLATFORM_LABELS } from "@/utils/format";

export async function showHistory(ctx: BotContext) {
  const items = await listRecentDownloadsForUser(ctx.dbUser.id, 10);
  if (items.length === 0) {
    await ctx.reply(`${t(ctx.locale, "history_title")}\n\n${t(ctx.locale, "history_empty")}`, {
      reply_markup: backToMenuKeyboard(ctx.locale),
    });
    return;
  }

  await ctx.reply(t(ctx.locale, "history_title"), { reply_markup: backToMenuKeyboard(ctx.locale) });
  for (const item of items) {
    const platform = PLATFORM_LABELS[item.platform] ?? item.platform;
    const icon = item.mediaType === "audio" ? "🎵" : "🎬";
    const caption = [
      `${icon} ${item.title ?? "Untitled"}`,
      `${platform} • ${formatDuration(item.durationSec)}`,
    ].join("\n");
    await ctx.reply(caption, { reply_markup: historyItemKeyboard(ctx.locale, item.id) });
  }
}

export function registerHistoryHandlers(bot: Bot<BotContext>) {
  bot.command("downloads", showHistory);
}
