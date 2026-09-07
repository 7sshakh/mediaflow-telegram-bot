import { runProcess } from "@/services/security/exec";
import { logger } from "@/core/logger";
import type { NormalizedYouTubeResult, YouTubeSearchProvider } from "./types";

/**
 * Default YouTube search provider — uses yt-dlp's `ytsearch` extractor.
 * This requires no API key/quota and returns real, live YouTube metadata
 * (title, channel, duration, thumbnail) directly from YouTube's search
 * results, which is why it is the zero-config default.
 */
export class YtDlpSearchProvider implements YouTubeSearchProvider {
  readonly name = "ytdlp";

  async search(query: string, limit: number): Promise<NormalizedYouTubeResult[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 10);
    const args = [
      `ytsearch${safeLimit}:${query}`,
      "-J",
      "--flat-playlist",
      "--no-warnings",
      "--no-check-certificates",
    ];
    const { promise } = runProcess("yt-dlp", args, { timeoutMs: 25_000 });
    const result = await promise;
    if (result.code !== 0) {
      logger.warn({ stderrTail: result.stderr.slice(-300) }, "ytdlp_search_failed");
      throw new Error("YouTube search failed");
    }
    let json: { entries?: Array<Record<string, unknown>> };
    try {
      json = JSON.parse(result.stdout);
    } catch {
      throw new Error("Could not parse YouTube search results");
    }
    const entries = json.entries ?? [];
    return entries.slice(0, safeLimit).map((entry) => this.normalize(entry));
  }

  private normalize(entry: Record<string, unknown>): NormalizedYouTubeResult {
    const id = String(entry.id ?? "");
    const thumbnails = (entry.thumbnails as Array<{ url: string; width?: number }>) ?? [];
    const bestThumb = thumbnails.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
    return {
      videoId: id,
      title: String(entry.title ?? "Untitled"),
      channel: String(entry.channel ?? entry.uploader ?? "Unknown"),
      duration: typeof entry.duration === "number" ? Math.round(entry.duration) : null,
      thumbnail: bestThumb ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
      viewCount: typeof entry.view_count === "number" ? entry.view_count : null,
      uploadedAt: (entry.upload_date as string) ?? null,
    };
  }
}
