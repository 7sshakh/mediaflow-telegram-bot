import { InputFile } from "grammy";
import type { BotContext } from "@/bot/types";
import { StatusMessage } from "./statusMessage";
import { t } from "@/bot/i18n/locales";
import { cancelKeyboard, mediaActionsKeyboard } from "@/bot/keyboards/keyboards";
import { validateAndDetectPlatform, canonicalizeUrl } from "@/services/security/url";
import { startDownloadPipeline, markTaskCompleted, markTaskFailed, type PipelineResult } from "@/services/pipeline/downloadPipeline";
import { getActiveTaskCountForUser } from "@/db/repo/tasks";
import { findRecentCachedDownload, createDownload, attachTelegramFile } from "@/db/repo/downloads";
import { removeDir } from "@/services/storage/tempStorage";
import { config } from "@/core/config";
import { logger } from "@/core/logger";
import { errorMessageFor } from "@/bot/utils/errorMessages";
import { formatDuration, formatBytes, progressBar, PLATFORM_LABELS } from "@/utils/format";
import type { MediaKind } from "@/services/downloader/types";

export interface DeliverMediaOptions {
  mode: MediaKind;
  statusMessage?: StatusMessage;
}

export async function deliverMediaForUrl(ctx: BotContext, rawUrl: string, options: DeliverMediaOptions): Promise<void> {
  const status = options.statusMessage ?? (await StatusMessage.send(ctx, t(ctx.locale, "status_checking")));

  let validated;
  try {
    validated = await validateAndDetectPlatform(rawUrl);
  } catch (err) {
    await status.update(errorMessageFor(ctx.locale, err), undefined, true);
    return;
  }

  const { url, platform } = validated;
  const canonicalUrl = canonicalizeUrl(url);
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  await status.update(t(ctx.locale, "status_platform_detected", { platform: platformLabel }), undefined, true);

  const activeCount = await getActiveTaskCountForUser(ctx.dbUser.id);
  if (activeCount >= config.limits.maxUserConcurrentDownloads) {
    await status.update(t(ctx.locale, "error_concurrent_limit"), undefined, true);
    return;
  }

  // Duplicate-download optimization: reuse a recent successful upload's file_id.
  const cached = await findRecentCachedDownload(canonicalUrl, options.mode);
  if (cached?.telegramFileId) {
    await status.update(t(ctx.locale, "status_ready"), undefined, true);
    await sendCachedMedia(ctx, cached, options.mode);
    return;
  }

  let taskId: string | undefined;
  try {
    const started = await startDownloadPipeline({
      userId: ctx.dbUser.id,
      rawUrl: url.toString(),
      mode: options.mode,
      videoQuality: ctx.dbUser.settings?.videoQuality,
      audioQualityKbps: ctx.dbUser.settings?.audioQuality ? (Number(ctx.dbUser.settings.audioQuality) as 128 | 192 | 320) : undefined,
      onProgress: (progress) => {
        const bar = progressBar(progress.percent);
        const sizeInfo =
          progress.downloadedBytes && progress.totalBytes
            ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
            : "";
        const speed = progress.speedBytesPerSec ? `${formatBytes(progress.speedBytesPerSec)}/s` : "";
        const eta = progress.etaSec ? `${progress.etaSec}s` : "";
        const lines = [
          t(ctx.locale, "status_downloading"),
          "",
          `${bar} ${Math.round(progress.percent)}%`,
          sizeInfo,
          speed || eta ? `${speed} ${eta ? `ETA: ${eta}` : ""}`.trim() : "",
        ].filter(Boolean);
        status.update(lines.join("\n"), cancelKeyboard(ctx.locale, taskId ?? "")).catch(() => undefined);
      },
    });
    taskId = started.taskId;
    await status.update(t(ctx.locale, "status_downloading"), cancelKeyboard(ctx.locale, taskId), true);

    const result = await started.result;

    await status.update(t(ctx.locale, "status_ready"), undefined, true);

    const download = await createDownload({
      userId: ctx.dbUser.id,
      taskId: result.taskId,
      url: url.toString(),
      canonicalUrl,
      platform,
      mediaType: options.mode,
      status: "COMPLETED",
      title: result.metadata.title,
      author: result.metadata.author,
      durationSec: result.metadata.durationSec,
      width: result.metadata.width,
      height: result.metadata.height,
      filesizeBytes: result.fileSizeBytes,
      thumbnailUrl: result.metadata.thumbnailUrl,
      completedAt: new Date(),
    });

    await sendFreshMedia(ctx, download.id, result, options.mode);
    await markTaskCompleted(result.taskId);
    await removeDir(result.tempDir);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "deliver_media_failed");
    await status.update(errorMessageFor(ctx.locale, err), undefined, true);
    if (taskId) await markTaskFailed(taskId, String(err));
  }
}

async function sendFreshMedia(
  ctx: BotContext,
  downloadId: string,
  result: PipelineResult,
  mode: MediaKind,
): Promise<void> {
  const inputFile = new InputFile(result.filePath);
  const caption = buildCaption(result.metadata, result.platform);
  const keyboard = mediaActionsKeyboard(ctx.locale, downloadId);

  if (mode === "audio") {
    const msg = await ctx.replyWithAudio(inputFile, {
      caption,
      title: result.metadata.title ?? undefined,
      performer: result.metadata.author ?? undefined,
      duration: result.metadata.durationSec ?? undefined,
      reply_markup: keyboard,
    });
    await attachTelegramFile(downloadId, msg.audio.file_id, "audio");
  } else {
    const msg = await ctx.replyWithVideo(inputFile, {
      caption,
      width: result.metadata.width ?? undefined,
      height: result.metadata.height ?? undefined,
      duration: result.metadata.durationSec ?? undefined,
      supports_streaming: true,
      reply_markup: keyboard,
    });
    await attachTelegramFile(downloadId, msg.video.file_id, "video");
  }
}

async function sendCachedMedia(
  ctx: BotContext,
  cached: Awaited<ReturnType<typeof findRecentCachedDownload>> & object,
  mode: MediaKind,
): Promise<void> {
  const caption = buildCaption(
    {
      title: cached.title,
      author: cached.author,
      durationSec: cached.durationSec,
      width: cached.width,
      height: cached.height,
    },
    cached.platform as "tiktok" | "instagram" | "youtube",
  );

  const download = await createDownload({
    userId: ctx.dbUser.id,
    url: cached.url,
    canonicalUrl: cached.canonicalUrl,
    platform: cached.platform,
    mediaType: mode,
    status: "COMPLETED",
    title: cached.title,
    author: cached.author,
    durationSec: cached.durationSec,
    width: cached.width,
    height: cached.height,
    filesizeBytes: cached.filesizeBytes,
    telegramFileId: cached.telegramFileId,
    telegramFileType: cached.telegramFileType,
    thumbnailUrl: cached.thumbnailUrl,
    completedAt: new Date(),
  });

  const keyboard = mediaActionsKeyboard(ctx.locale, download.id);
  if (mode === "audio") {
    await ctx.replyWithAudio(cached.telegramFileId as string, { caption, reply_markup: keyboard });
  } else {
    await ctx.replyWithVideo(cached.telegramFileId as string, { caption, reply_markup: keyboard });
  }
}

function buildCaption(
  metadata: { title: string | null; author: string | null; durationSec: number | null; width: number | null; height: number | null },
  platform: string,
): string {
  const parts: string[] = [];
  if (metadata.title) parts.push(metadata.title.slice(0, 200));
  const meta: string[] = [PLATFORM_LABELS[platform] ?? platform];
  if (metadata.author) meta.push(`👤 ${metadata.author}`);
  if (metadata.durationSec) meta.push(`⏱ ${formatDuration(metadata.durationSec)}`);
  if (metadata.width && metadata.height) meta.push(`📐 ${metadata.width}x${metadata.height}`);
  parts.push(meta.join(" • "));
  return parts.join("\n\n");
}
