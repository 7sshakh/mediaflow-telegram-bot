import path from "node:path";
import fs from "node:fs/promises";
import { runProcess } from "@/services/security/exec";
import { logger } from "@/core/logger";

/**
 * FFmpeg integration: audio extraction for music recognition, and safe
 * transcoding for the rare case a source file isn't Telegram-compatible.
 * Never re-encodes unnecessarily.
 */

export interface ProbeResult {
  durationSec: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  width: number | null;
  height: number | null;
}

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const args = [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];
  const { promise } = runProcess("ffprobe", args, { timeoutMs: 15_000 });
  const { stdout } = await promise;
  try {
    const json = JSON.parse(stdout);
    const streams: Array<Record<string, unknown>> = json.streams ?? [];
    const videoStream = streams.find((s) => s.codec_type === "video");
    const audioStream = streams.find((s) => s.codec_type === "audio");
    return {
      durationSec: json.format?.duration ? Math.round(Number(json.format.duration)) : null,
      videoCodec: (videoStream?.codec_name as string) ?? null,
      audioCodec: (audioStream?.codec_name as string) ?? null,
      container: (json.format?.format_name as string) ?? null,
      width: (videoStream?.width as number) ?? null,
      height: (videoStream?.height as number) ?? null,
    };
  } catch {
    return { durationSec: null, videoCodec: null, audioCodec: null, container: null, width: null, height: null };
  }
}

/** Extract a short audio segment for music recognition (mp3, mono-safe, small). */
export async function extractAudioSegment(
  inputPath: string,
  outputDir: string,
  startSec: number,
  durationSec: number,
): Promise<string> {
  const outputPath = path.join(outputDir, `sample_${startSec}_${durationSec}.mp3`);
  const args = [
    "-y",
    "-ss",
    String(Math.max(0, Math.floor(startSec))),
    "-t",
    String(durationSec),
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "44100",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "128k",
    outputPath,
  ];
  const { promise } = runProcess("ffmpeg", args, { timeoutMs: 30_000 });
  const result = await promise;
  if (result.code !== 0) {
    logger.warn({ stderrTail: result.stderr.slice(-300) }, "ffmpeg_extract_failed");
    throw new Error("Failed to extract audio segment");
  }
  return outputPath;
}

/** Extract full-length audio track (used for the standalone "Audio" button). */
export async function extractFullAudio(
  inputPath: string,
  outputDir: string,
  bitrateKbps: 128 | 192 | 320 = 192,
): Promise<string> {
  const outputPath = path.join(outputDir, `audio_${bitrateKbps}k.mp3`);
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-acodec",
    "libmp3lame",
    "-b:a",
    `${bitrateKbps}k`,
    outputPath,
  ];
  const { promise } = runProcess("ffmpeg", args, { timeoutMs: 60_000 });
  const result = await promise;
  if (result.code !== 0) {
    logger.warn({ stderrTail: result.stderr.slice(-300) }, "ffmpeg_audio_extract_failed");
    throw new Error("Failed to extract audio");
  }
  return outputPath;
}

/** Ensure the file uses a Telegram-friendly container/codec; transcode only if required. */
export async function ensureTelegramCompatibleVideo(inputPath: string, outputDir: string): Promise<string> {
  const probe = await probeMedia(inputPath);
  const compatible =
    (probe.container ?? "").includes("mp4") &&
    (probe.videoCodec === "h264" || probe.videoCodec === null) &&
    (probe.audioCodec === "aac" || probe.audioCodec === null);

  if (compatible) return inputPath;

  const outputPath = path.join(outputDir, "compat.mp4");
  const args = [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];
  const { promise } = runProcess("ffmpeg", args, { timeoutMs: 4 * 60_000 });
  const result = await promise;
  if (result.code !== 0) {
    logger.warn({ stderrTail: result.stderr.slice(-300) }, "ffmpeg_transcode_failed");
    return inputPath; // best-effort fallback, better to send original than fail outright
  }
  return outputPath;
}

export async function fileSizeBytes(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}
