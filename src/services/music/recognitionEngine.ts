import { config } from "@/core/config";
import { logger } from "@/core/logger";
import { probeMedia, extractAudioSegment } from "@/services/media/ffmpeg";
import { getMusicProvider } from "@/services/music";
import type { RecognitionResult } from "@/services/music/base";

export interface RecognitionOutcome {
  matched: boolean;
  best: RecognitionResult | null;
  candidates: RecognitionResult[];
  provider: string;
}

function segmentStartsFor(durationSec: number, sampleSec: number, attempts: number): number[] {
  const starts: number[] = [];
  const middle = Math.max(0, Math.floor(durationSec / 2 - sampleSec / 2));
  const beginning = Math.min(5, Math.max(0, durationSec - sampleSec));
  const later = Math.max(0, Math.floor(durationSec - sampleSec - 5));
  const candidates = [middle, beginning, later];
  for (let i = 0; i < attempts; i++) starts.push(candidates[i] ?? candidates[candidates.length - 1]);
  return [...new Set(starts)];
}

function dedupeKey(r: RecognitionResult): string {
  return `${r.title.toLowerCase().trim()}::${r.artist.toLowerCase().trim()}`;
}

/**
 * Smart recognition: tries up to RECOGNITION_MAX_ATTEMPTS real recognition
 * calls against different segments of the source audio (middle, beginning,
 * end). Every returned candidate is a genuine provider match — never
 * fabricated data. If several distinct songs are detected across attempts
 * (common for videos with intro/outro music changes) they are all surfaced
 * to the user to choose from.
 */
export async function recognizeFromMedia(mediaFilePath: string, workDir: string): Promise<RecognitionOutcome> {
  const provider = getMusicProvider();
  if (!provider.isConfigured) {
    throw Object.assign(new Error("Music recognition is not configured"), { code: "NOT_CONFIGURED" });
  }

  const probe = await probeMedia(mediaFilePath);
  const durationSec = probe.durationSec ?? config.music.sampleSeconds * 2;
  const sampleSec = Math.min(config.music.sampleSeconds, Math.max(6, durationSec));
  const starts = segmentStartsFor(durationSec, sampleSec, config.music.maxAttempts);

  const candidates: RecognitionResult[] = [];
  const seen = new Set<string>();

  for (const start of starts) {
    try {
      const segmentPath = await extractAudioSegment(mediaFilePath, workDir, start, sampleSec);
      const result = await provider.recognize(segmentPath);
      if (result) {
        const key = dedupeKey(result);
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(result);
        }
      }
    } catch (err) {
      logger.warn({ err: String(err), start }, "recognition_attempt_failed");
    }
    if (candidates.length >= 10) break;
  }

  return {
    matched: candidates.length > 0,
    best: candidates[0] ?? null,
    candidates: candidates.slice(0, 10),
    provider: provider.name,
  };
}
