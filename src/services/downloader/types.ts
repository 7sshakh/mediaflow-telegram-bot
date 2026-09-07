export interface MediaMetadata {
  id: string;
  title: string | null;
  author: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  filesizeApproxBytes: number | null;
  ext: string | null;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSec: number | null;
  etaSec: number | null;
}

export interface DownloadedMedia {
  filePath: string;
  fileSizeBytes: number;
  metadata: MediaMetadata;
}

export type MediaKind = "video" | "audio";

export interface DownloadOptions {
  mode: MediaKind;
  destDir: string;
  audioQualityKbps?: 128 | 192 | 320;
  videoQuality?: "best" | "1080" | "720" | "480";
  maxFileSizeBytes: number;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}
