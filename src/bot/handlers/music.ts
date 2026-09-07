import type { Bot } from "grammy";
import type { BotContext } from "@/bot/types";
import { t } from "@/bot/i18n/locales";
import { decodeCallback } from "@/bot/utils/callbackData";
import { StatusMessage } from "@/bot/services/statusMessage";
import { recognitionResultKeyboard, recognitionCandidatesKeyboard, backToMenuKeyboard } from "@/bot/keyboards/keyboards";
import { getDownload } from "@/db/repo/downloads";
import { findRecognitionByDownload, createRecognition, getRecognition } from "@/db/repo/recognitions";
import { recognizeFromMedia } from "@/services/music/recognitionEngine";
import { getMusicProvider } from "@/services/music";
import { MusicProviderNotConfiguredError } from "@/services/music/base";
import { createTaskDir, removeDir } from "@/services/storage/tempStorage";
import { config } from "@/core/config";
import { logger } from "@/core/logger";
import { searchAndSendYoutube } from "./youtube";

async function downloadTelegramFileToDisk(ctx: BotContext, fileId: string, destDir: string): Promise<string> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram did not return a file path");
  const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch media from Telegram (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = file.file_path.split(".").pop() ?? "bin";
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const target = path.join(destDir, `source.${ext}`);
  await fs.writeFile(target, buffer);
  return target;
}

async function renderRecognitionResult(ctx: BotContext, recognitionId: string) {
  const recognition = await getRecognition(recognitionId);
  if (!recognition) return;

  if (!recognition.matched || !recognition.title) {
    await ctx.reply(t(ctx.locale, "music_no_match"), { reply_markup: backToMenuKeyboard(ctx.locale) });
    return;
  }

  const candidates = recognition.candidates ?? [];
  if (candidates.length > 1) {
    const lines = [t(ctx.locale, "music_found_title"), ""];
    candidates.forEach((c, i) => lines.push(`${i + 1}. ${c.title}\n   ${c.artist}`));
    await ctx.reply(lines.join("\n"), {
      reply_markup: recognitionCandidatesKeyboard(ctx.locale, recognitionId, candidates),
    });
    return;
  }

  const cover = recognition.coverUrl;
  const text = [
    t(ctx.locale, "music_found_title"),
    "",
    `${t(ctx.locale, "music_field_title")}: ${recognition.title}`,
    `${t(ctx.locale, "music_field_artist")}: ${recognition.artist}`,
    recognition.album ? `${t(ctx.locale, "music_field_album")}: ${recognition.album}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const keyboard = recognitionResultKeyboard(ctx.locale, recognitionId);
  if (cover) {
    await ctx.replyWithPhoto(cover, { caption: text, reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  } else {
    await ctx.reply(text, { reply_markup: keyboard });
  }

  if (recognition.youtubeQuery) {
    await searchAndSendYoutube(ctx, recognition.youtubeQuery);
  }
}

async function recognizeForDownload(ctx: BotContext, downloadId: string) {
  const download = await getDownload(downloadId);
  if (!download || download.userId !== ctx.dbUser.id) return;

  const cachedRecognition = await findRecognitionByDownload(downloadId);
  if (cachedRecognition) {
    await renderRecognitionResult(ctx, cachedRecognition.id);
    return;
  }

  const provider = getMusicProvider();
  if (!provider.isConfigured) {
    await ctx.reply(t(ctx.locale, "music_no_key"));
    return;
  }

  if (!download.telegramFileId) {
    await ctx.reply(t(ctx.locale, "error_unavailable"));
    return;
  }

  const status = await StatusMessage.send(ctx, t(ctx.locale, "status_processing_audio"));
  const { dir } = await createTaskDir();
  try {
    const sourcePath = await downloadTelegramFileToDisk(ctx, download.telegramFileId, dir);
    await status.update(t(ctx.locale, "status_recognizing"), undefined, true);

    const outcome = await recognizeFromMedia(sourcePath, dir);
    const best = outcome.best;

    const saved = await createRecognition({
      downloadId,
      userId: ctx.dbUser.id,
      provider: outcome.provider,
      matched: outcome.matched,
      title: best?.title ?? null,
      artist: best?.artist ?? null,
      album: best?.album ?? null,
      releaseDate: best?.releaseDate ?? null,
      coverUrl: best?.coverUrl ?? null,
      isrc: best?.isrc ?? null,
      appleMusicUrl: best?.appleMusicUrl ?? null,
      spotifyUrl: best?.spotifyUrl ?? null,
      youtubeQuery: best?.youtubeSearchQuery ?? null,
      confidence: best?.confidence ?? null,
      candidates: outcome.candidates.map((c) => ({
        title: c.title,
        artist: c.artist,
        album: c.album ?? undefined,
        coverUrl: c.coverUrl ?? undefined,
        appleMusicUrl: c.appleMusicUrl ?? undefined,
        spotifyUrl: c.spotifyUrl ?? undefined,
      })),
    });

    await status.remove();
    await renderRecognitionResult(ctx, saved.id);
  } catch (err) {
    if (err instanceof MusicProviderNotConfiguredError) {
      await status.update(t(ctx.locale, "music_no_key"), undefined, true);
    } else {
      logger.warn({ err: String(err) }, "music_recognition_failed");
      await status.update(t(ctx.locale, "error_generic", { reason: t(ctx.locale, "error_unavailable") }), undefined, true);
    }
  } finally {
    await removeDir(dir);
  }
}

export async function handleMusicQueryText(ctx: BotContext, query: string): Promise<void> {
  await searchAndSendYoutube(ctx, query);
}

export function registerMusicHandlers(bot: Bot<BotContext>) {
  bot.on("callback_query:data", async (ctx, next) => {
    const decoded = decodeCallback(ctx.callbackQuery.data);
    if (!decoded) return next();

    if (decoded.action === "music") {
      const [downloadId] = decoded.parts;
      await ctx.answerCallbackQuery();
      await recognizeForDownload(ctx, downloadId);
      return;
    }

    if (decoded.action === "rec_pick") {
      const [recognitionId, indexStr] = decoded.parts;
      await ctx.answerCallbackQuery();
      const recognition = await getRecognition(recognitionId);
      if (!recognition || recognition.userId !== ctx.dbUser.id) return;
      const candidate = (recognition.candidates ?? [])[Number(indexStr)];
      if (!candidate) return;
      await searchAndSendYoutube(ctx, `${candidate.title} ${candidate.artist}`);
      return;
    }

    if (decoded.action === "ytsearch_from_rec") {
      const [recognitionId] = decoded.parts;
      await ctx.answerCallbackQuery();
      const recognition = await getRecognition(recognitionId);
      if (!recognition || recognition.userId !== ctx.dbUser.id || !recognition.youtubeQuery) return;
      await searchAndSendYoutube(ctx, recognition.youtubeQuery);
      return;
    }

    return next();
  });
}
