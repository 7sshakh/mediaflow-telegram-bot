import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { isAdmin, config } from "@/core/config";
import { adminMenuKeyboard, backToMenuKeyboard } from "@/bot/keyboards/keyboards";
import { decodeCallback } from "@/bot/utils/callbackData";
import { countUsers, countActiveUsersSince, setUserBlocked } from "@/db/repo/users";
import {
  countDownloadsSince,
  countByPlatformSince,
  countFailedSince,
} from "@/db/repo/downloads";
import { countRecognitionsSince } from "@/db/repo/recognitions";
import { getActiveGlobalTaskCount } from "@/db/repo/tasks";
import { getQueueLength, getActiveCount } from "@/services/queue/downloadQueue";
import { sweepAbandonedTempDirs } from "@/services/storage/tempStorage";
import { logAdminAction } from "@/db/repo/admin";

function requireAdmin(ctx: BotContext): boolean {
  return isAdmin(ctx.from?.id ?? -1);
}

async function renderStats(ctx: BotContext) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeToday,
    downloadsToday,
    downloadsWeek,
    downloadsMonth,
    tiktokCount,
    instagramCount,
    youtubeCount,
    recognitionsMonth,
    failedToday,
  ] = await Promise.all([
    countUsers(),
    countActiveUsersSince(startOfDay),
    countDownloadsSince(startOfDay),
    countDownloadsSince(startOfWeek),
    countDownloadsSince(startOfMonth),
    countByPlatformSince("tiktok", startOfMonth),
    countByPlatformSince("instagram", startOfMonth),
    countByPlatformSince("youtube", startOfMonth),
    countRecognitionsSince(startOfMonth),
    countFailedSince(startOfDay),
  ]);

  const text = [
    t(ctx.locale, "admin_stats_title"),
    "",
    `👥 Total users: ${totalUsers}`,
    `🟢 Active today: ${activeToday}`,
    "",
    `📥 Downloads today: ${downloadsToday}`,
    `📥 Downloads this week: ${downloadsWeek}`,
    `📥 Downloads this month: ${downloadsMonth}`,
    "",
    `🎬 TikTok (30d): ${tiktokCount}`,
    `📸 Instagram (30d): ${instagramCount}`,
    `▶️ YouTube (30d): ${youtubeCount}`,
    "",
    `🎵 Music recognitions (30d): ${recognitionsMonth}`,
    `❌ Failed downloads today: ${failedToday}`,
    "",
    `🧵 Active jobs: ${getActiveCount()} | Queue length: ${getQueueLength()}`,
    `📊 Active tasks (DB): ${await getActiveGlobalTaskCount()}`,
  ].join("\n");

  await ctx.reply(text, { reply_markup: backToMenuKeyboard(ctx.locale) });
}

export function registerAdminHandlers(bot: Bot<BotContext>) {
  bot.command("admin", async (ctx) => {
    if (!requireAdmin(ctx)) {
      await ctx.reply(t(ctx.locale, "admin_not_authorized"));
      return;
    }
    await ctx.reply(t(ctx.locale, "admin_menu_title"), { reply_markup: adminMenuKeyboard() });
  });

  bot.command("block", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const targetId = Number(ctx.match?.toString().trim());
    if (!targetId) {
      await ctx.reply("Usage: /block <telegram_id>");
      return;
    }
    await setUserBlocked(targetId, true);
    await logAdminAction({ adminTelegramId: ctx.from!.id, action: "block_user", targetUserId: targetId });
    await ctx.reply(`🚫 Blocked user ${targetId}`);
  });

  bot.command("unblock", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const targetId = Number(ctx.match?.toString().trim());
    if (!targetId) {
      await ctx.reply("Usage: /unblock <telegram_id>");
      return;
    }
    await setUserBlocked(targetId, false);
    await logAdminAction({ adminTelegramId: ctx.from!.id, action: "unblock_user", targetUserId: targetId });
    await ctx.reply(`✅ Unblocked user ${targetId}`);
  });

  bot.command("broadcast", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const message = ctx.match?.toString().trim();
    if (!message) {
      await ctx.reply("Usage: /broadcast <message>");
      return;
    }
    await logAdminAction({ adminTelegramId: ctx.from!.id, action: "broadcast", details: { message } });
    await ctx.reply("📢 Broadcast queued (implement fan-out via a background worker for large user bases).");
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded || decoded.action !== "admin") return next();
    if (!requireAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: t(ctx.locale, "admin_not_authorized") });
      return;
    }
    await ctx.answerCallbackQuery();
    const [section] = decoded.parts;

    switch (section) {
      case "stats":
        await renderStats(ctx);
        return;
      case "cleanup": {
        const removed = await sweepAbandonedTempDirs();
        await ctx.reply(`🧹 Removed ${removed} abandoned temp folder(s).`, { reply_markup: backToMenuKeyboard(ctx.locale) });
        return;
      }
      case "system": {
        const text = [
          "🔧 System status",
          "",
          `Node: ${process.version}`,
          `Active jobs: ${getActiveCount()}`,
          `Queue length: ${getQueueLength()}`,
          `Redis: ${config.redis.url ? "configured" : "in-memory fallback"}`,
          `Music provider: ${config.music.provider} (${config.music.apiKey ? "configured" : "NOT configured"})`,
          `YouTube provider: ${config.youtube.searchProvider}`,
        ].join("\n");
        await ctx.reply(text, { reply_markup: backToMenuKeyboard(ctx.locale) });
        return;
      }
      case "users":
        await ctx.reply(`👥 Total users: ${await countUsers()}\nUse /block <id> or /unblock <id>.`, {
          reply_markup: backToMenuKeyboard(ctx.locale),
        });
        return;
      case "downloads":
      case "music":
        await renderStats(ctx);
        return;
      default:
        return;
    }
  });
}
