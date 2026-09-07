import { validateAndDetectPlatform, canonicalizeUrl, UrlSecurityError, type Platform } from "@/services/security/url";
import { getDownloaderFor } from "@/services/downloader/base";
import { DownloadError } from "@/services/downloader/ytdlp";
import { ensureTelegramCompatibleVideo } from "@/services/media/ffmpeg";
import { createTaskDir, removeDir } from "@/services/storage/tempStorage";
import { enqueueJob, registerCancelHandle, unregisterCancelHandle } from "@/services/queue/downloadQueue";
import { createTask, updateTaskStatus } from "@/db/repo/tasks";
import { config } from "@/core/config";
import { logger } from "@/core/logger";
import type { DownloadProgress, MediaKind, MediaMetadata } from "@/services/downloader/types";

export interface PipelineResult {
  taskId: string;
  tempDir: string;
  filePath: string;
  fileSizeBytes: number;
  metadata: MediaMetadata;
  platform: Platform;
  canonicalUrl: string;
  mediaType: MediaKind;
}

export interface StartDownloadParams {
  userId: string; // internal DB user id
  rawUrl: string;
  mode: MediaKind;
  videoQuality?: "best" | "1080" | "720" | "480";
  audioQualityKbps?: 128 | 192 | 320;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface StartedPipeline {
  taskId: string;
  result: Promise<PipelineResult>;
}

/**
 * Resolves quickly with the created taskId (so the caller can immediately
 * show a Cancel button tied to it), while `result` resolves once the
 * download/processing actually finishes.
 */
export async function startDownloadPipeline(params: StartDownloadParams): Promise<StartedPipeline> {
  const { url, platform } = await validateAndDetectPlatform(params.rawUrl);
  const canonicalUrl = canonicalizeUrl(url);

  const task = await createTask({ userId: params.userId, type: "download", url: url.toString(), platform });

  const run = async (): Promise<PipelineResult> => {
    await updateTaskStatus(task.id, "DOWNLOADING");
    const downloader = getDownloaderFor(platform);

    const metadata = await downloader.getMetadata(url.toString());
    if (metadata.durationSec && metadata.durationSec > config.limits.maxVideoDurationSeconds) {
      await updateTaskStatus(task.id, "FAILED", { error: "DURATION_LIMIT" });
      throw new DownloadError("Media exceeds the maximum allowed duration", "TOO_LONG");
    }

    const { dir: tempDir } = await createTaskDir();
    const controller = new AbortController();

    try {
      const { promise, cancel } = downloader.download(url.toString(), {
        mode: params.mode,
        destDir: tempDir,
        maxFileSizeBytes: config.limits.maxFileSizeBytes,
        videoQuality: params.videoQuality,
        audioQualityKbps: params.audioQualityKbps,
        signal: controller.signal,
        onProgress: async (progress) => {
          params.onProgress?.(progress);
          await updateTaskStatus(task.id, "DOWNLOADING", { progress: Math.round(progress.percent) }).catch(() => undefined);
        },
      });
      registerCancelHandle(task.id, () => {
        controller.abort();
        cancel();
      });

      const downloaded = await promise;
      await updateTaskStatus(task.id, "PROCESSING", { progress: 100 });

      let finalPath = downloaded.filePath;
      if (params.mode === "video") {
        finalPath = await ensureTelegramCompatibleVideo(downloaded.filePath, tempDir);
      }

      return {
        taskId: task.id,
        tempDir,
        filePath: finalPath,
        fileSizeBytes: downloaded.fileSizeBytes,
        metadata: downloaded.metadata,
        platform,
        canonicalUrl,
        mediaType: params.mode,
      };
    } catch (err) {
      await removeDir(tempDir);
      const isCancelled = err instanceof DownloadError && err.code === "CANCELLED";
      await updateTaskStatus(task.id, isCancelled ? "CANCELLED" : "FAILED", {
        error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
      });
      throw err;
    } finally {
      unregisterCancelHandle(task.id);
    }
  };

  const result = enqueueJob(task.id, run).catch((err) => {
    if (err instanceof UrlSecurityError) {
      updateTaskStatus(task.id, "FAILED", { error: err.code }).catch(() => undefined);
    }
    logger.warn({ taskId: task.id, err: err instanceof Error ? err.message : String(err) }, "download_pipeline_failed");
    throw err;
  });

  return { taskId: task.id, result };
}

export async function markTaskCompleted(taskId: string) {
  await updateTaskStatus(taskId, "COMPLETED", { progress: 100 });
}

export async function markTaskFailed(taskId: string, error: string) {
  await updateTaskStatus(taskId, "FAILED", { error: error.slice(0, 300) });
}
