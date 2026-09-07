import fs from "node:fs/promises";
import { config } from "@/core/config";
import { logger } from "@/core/logger";
import type { MusicRecognitionProvider, RecognitionResult } from "./base";
import { MusicProviderNotConfiguredError } from "./base";

/**
 * AudD (https://audd.io) — a real, keyed, Shazam-class music recognition
 * API. We upload a short audio sample as multipart/form-data and request
 * enriched metadata (Apple Music + Spotify links, ISRC, etc.).
 */
interface AuddApiResponse {
  status: "success" | "error";
  result: null | {
    artist: string;
    title: string;
    album?: string;
    release_date?: string;
    label?: string;
    timecode?: string;
    song_link?: string;
    isrc?: string;
    score?: number;
    apple_music?: { url?: string; artwork?: { url?: string } };
    spotify?: { external_urls?: { spotify?: string }; album?: { images?: Array<{ url: string }> } };
  };
  error?: { error_code: number; error_message: string };
}

export class AudDProvider implements MusicRecognitionProvider {
  readonly name = "audd";

  get isConfigured(): boolean {
    return Boolean(config.music.apiKey);
  }

  async recognize(audioFilePath: string): Promise<RecognitionResult | null> {
    if (!this.isConfigured) throw new MusicProviderNotConfiguredError(this.name);

    const fileBuffer = await fs.readFile(audioFilePath);
    const form = new FormData();
    form.append("api_token", config.music.apiKey);
    form.append("return", "apple_music,spotify");
    form.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], { type: "audio/mpeg" }),
      "sample.mp3",
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(config.music.baseUrl, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      logger.error({ err: String(err) }, "audd_request_failed");
      throw new Error("Music recognition service is unreachable");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Music recognition service returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as AuddApiResponse;
    if (json.status === "error") {
      logger.error({ error: json.error }, "audd_api_error");
      throw new Error("Music recognition service rejected the request");
    }
    if (!json.result) return null;

    const r = json.result;
    const coverUrl =
      r.apple_music?.artwork?.url?.replace("{w}", "600").replace("{h}", "600") ??
      r.spotify?.album?.images?.[0]?.url ??
      null;

    return {
      title: r.title,
      artist: r.artist,
      album: r.album ?? null,
      releaseDate: r.release_date ?? null,
      coverUrl,
      isrc: r.isrc ?? null,
      confidence: typeof r.score === "number" ? r.score : null,
      appleMusicUrl: r.apple_music?.url ?? null,
      spotifyUrl: r.spotify?.external_urls?.spotify ?? null,
      youtubeSearchQuery: `${r.title} ${r.artist}`.trim(),
    };
  }
}
