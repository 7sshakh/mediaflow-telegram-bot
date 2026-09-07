import path from "node:path";
import { runProcess, ProcessCancelledError, ProcessTimeoutError } from "@/services/security/exec";
import { findLargestMediaFile } from "@/services/storage/tempStorage";
import { logger } from "@/core/logger";
import type { DownloadOptions, DownloadedMedia, MediaMetadata } from "./types";

/**
 * Thin, secure wrapper around the yt-dlp CLI.
 *
 * All invocations use an argument array passed to `spawn` (see
 * services/security/exec.ts) — never a shell string, never string
 * concatenation with user input. The URL itself is always the value
 * that already passed `validateAndDetectPlatform` (domain allow-list +
 * SSRF / private-network checks).
 */

const YTDLP_BIN = "yt-dlp";
export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNAVAILABLE"
      | "TIMEOUT"
      | "TOO_LARGE"
      | "TOO_LONG"
      | "CANCELLED"
      | "GEO_RESTRICTED"
      | "PRIVATE"
      | "UNKNOWN",
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

function classifyStderr(stderr: string): DownloadError["code"] {
  const s = stderr.toLowerCase();
  if (s.includes("private") || s.includes("login required")) return "PRIVATE";
  if (s.includes("not available in your country") || s.includes("geo")) return "GEO_RESTRICTED";
  if (s.includes("video unavailable") || s.includes("this video is unavailable") || s.includes("404"))
    return "UNAVAILABLE";
  return "UNKNOWN";
}

export async function fetchMetadata(url: string, timeoutMs = 20_000): Promise<MediaMetadata> {
  const args = ["-J", "--no-warnings", "--no-playlist", "--no-check-certificates", url];
  const { promise } = runProcess(YTDLP_BIN, args, { timeoutMs });
  let result;
  try {
    result = await promise;
  } catch (err) {
    if (err instanceof ProcessTimeoutError) throw new DownloadError("Metadata fetch timed out", "TIMEOUT");
    throw new DownloadError("Failed to read metadata", "UNKNOWN");
  }
  if (result.code !== 0) {
    throw new DownloadError(result.stderr.slice(0, 500) || "yt-dlp metadata error", classifyStderr(result.stderr));
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    throw new DownloadError("Could not parse metadata", "UNKNOWN");
  }
  return {
    id: String(json.id ?? ""),
    title: (json.title as string) ?? null,
    author: (json.uploader as string) ?? (json.channel as string) ?? null,
    durationSec: typeof json.duration === "number" ? Math.round(json.duration) : null,
    width: (json.width as number) ?? null,
    height: (json.height as number) ?? null,
    thumbnailUrl: (json.thumbnail as string) ?? null,
    filesizeApproxBytes:
      (json.filesize as number) ?? (json.filesize_approx as number) ?? null,
    ext: (json.ext as string) ?? null,
  };
}

function parseProgressLine(line: string): { percent: number; downloaded: number | null; total: number | null; speed: number | null; eta: number | null } | null {
  // Structured progress emitted via --progress-template, pipe-delimited:
  // MFPROGRESS|<percent>|<downloaded_bytes>|<total_bytes>|<speed_bps>|<eta_sec>
  if (!line.startsWith("MFPROGRESS|")) return null;
  const [, pct, down, total, speed, eta] = line.split("|");
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    percent: num(pct) ?? 0,
    downloaded: num(down),
    total: num(total),
    speed: num(speed),
    eta: num(eta),
  };
}

export function downloadMedia(url: string, options: DownloadOptions): {
  promise: Promise<DownloadedMedia>;
  cancel: () => void;
} {
  const outputTemplate = path.join(options.destDir, "%(id)s.%(ext)s");
  const args = [
    url,
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificates",
    "--newline",
    "--restrict-filenames",
    "--no-continue",
    "--retries",
    "3",
    "--socket-timeout",
    "20",
    "--max-filesize",
    String(options.maxFileSizeBytes),
    "--progress-template",
    "MFPROGRESS|%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
    "-o",
    outputTemplate,
    "--write-info-json",
  ];

  if (options.mode === "audio") {
    args.push("-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", `${options.audioQualityKbps ?? 192}K`);
  } else {
    const heightFilter =
      options.videoQuality && options.videoQuality !== "best"
        ? `[height<=${options.videoQuality}]`
        : "";
    args.push(
      "-f",
      `bestvideo${heightFilter}[ext=mp4]+bestaudio[ext=m4a]/best${heightFilter}[ext=mp4]/best${heightFilter}/best`,
      "--merge-output-format",
      "mp4",
    );
  }

  let lastProgress = 0;
  const { promise: rawPromise, cancel } = runProcess("yt-dlp", args, {
    timeoutMs: 5 * 60_000,
    signal: options.signal,
    onStdoutLine: (line) => {
      const parsed = parseProgressLine(line);
      if (!parsed || !options.onProgress) return;
      const now = Date.now();
      if (now - lastProgress < 800 && parsed.percent < 100) return; // throttle updates
      lastProgress = now;
      options.onProgress({
        percent: parsed.percent,
        downloadedBytes: parsed.downloaded,
        totalBytes: parsed.total,
        speedBytesPerSec: parsed.speed,
        etaSec: parsed.eta,
      });
    },
  });

  const promise = (async (): Promise<DownloadedMedia> => {
    let result;
    try {
      result = await rawPromise;
    } catch (err) {
      if (err instanceof ProcessCancelledError) throw new DownloadError("Download cancelled", "CANCELLED");
      if (err instanceof ProcessTimeoutError) throw new DownloadError("Download timed out", "TIMEOUT");
      throw new DownloadError("Download failed", "UNKNOWN");
    }
    if (result.code !== 0) {
      const code = classifyStderr(result.stderr);
      if (result.stderr.toLowerCase().includes("max-filesize")) {
        throw new DownloadError("File exceeds the configured maximum size", "TOO_LARGE");
      }
      logger.warn({ code, stderrTail: result.stderr.slice(-400) }, "ytdlp_download_failed");
      throw new DownloadError(result.stderr.slice(0, 500) || "yt-dlp download error", code);
    }

    const filePath = await findLargestMediaFile(options.destDir);
    if (!filePath) throw new DownloadError("Downloaded file not found", "UNKNOWN");

    const fs = await import("node:fs/promises");
    const stat = await fs.stat(filePath);

    let metadata: MediaMetadata = {
      id: path.parse(filePath).name,
      title: null,
      author: null,
      durationSec: null,
      width: null,
      height: null,
      thumbnailUrl: null,
      filesizeApproxBytes: stat.size,
      ext: path.extname(filePath).replace(".", ""),
    };
    try {
      const infoPath = (await import("node:fs")).readdirSync(options.destDir).find((f) => f.endsWith(".info.json"));
      if (infoPath) {
        const raw = await fs.readFile(path.join(options.destDir, infoPath), "utf8");
        const json = JSON.parse(raw);
        metadata = {
          id: String(json.id ?? metadata.id),
          title: json.title ?? null,
          author: json.uploader ?? json.channel ?? null,
          durationSec: typeof json.duration === "number" ? Math.round(json.duration) : null,
          width: json.width ?? null,
          height: json.height ?? null,
          thumbnailUrl: json.thumbnail ?? null,
          filesizeApproxBytes: stat.size,
          ext: json.ext ?? metadata.ext,
        };
      }
    } catch {
      /* metadata is best-effort */
    }

    return { filePath, fileSizeBytes: stat.size, metadata };
  })();

  return { promise, cancel };
}
