import type { Platform } from "@/services/security/url";
import type { DownloadOptions, DownloadedMedia, MediaMetadata } from "./types";
import { downloadMedia, fetchMetadata } from "./ytdlp";

/**
 * Common interface every platform downloader implements. Adding a new
 * platform (Facebook, Twitter/X, SoundCloud, ...) only requires a new class
 * implementing this interface plus a domain allow-list entry in
 * services/security/url.ts — the rest of the pipeline (queue, ffmpeg,
 * Telegram delivery, music recognition) stays untouched.
 */
export interface PlatformDownloader {
  readonly platform: Platform;
  getMetadata(url: string): Promise<MediaMetadata>;
  download(url: string, options: DownloadOptions): { promise: Promise<DownloadedMedia>; cancel: () => void };
}

abstract class YtDlpBackedDownloader implements PlatformDownloader {
  abstract readonly platform: Platform;

  getMetadata(url: string): Promise<MediaMetadata> {
    return fetchMetadata(url);
  }

  download(url: string, options: DownloadOptions) {
    return downloadMedia(url, options);
  }
}

export class TikTokDownloader extends YtDlpBackedDownloader {
  readonly platform: Platform = "tiktok";
}

export class InstagramDownloader extends YtDlpBackedDownloader {
  readonly platform: Platform = "instagram";
}

export class YouTubeDownloader extends YtDlpBackedDownloader {
  readonly platform: Platform = "youtube";
}

const downloaders: Record<Platform, PlatformDownloader> = {
  tiktok: new TikTokDownloader(),
  instagram: new InstagramDownloader(),
  youtube: new YouTubeDownloader(),
};

export function getDownloaderFor(platform: Platform): PlatformDownloader {
  return downloaders[platform];
}
