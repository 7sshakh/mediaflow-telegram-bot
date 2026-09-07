import { config } from "@/core/config";
import { cacheGet, cacheSet } from "@/services/cache/cache";
import { YtDlpSearchProvider } from "./ytdlpSearch";
import { YouTubeDataApiProvider } from "./dataApiSearch";
import type { NormalizedYouTubeResult, YouTubeSearchProvider } from "./types";

/**
 * YouTubeSearchService — provider-agnostic facade with result caching to
 * avoid repeatedly processing identical requests (Section 30/31).
 */
export class YouTubeSearchService {
  private provider: YouTubeSearchProvider;

  constructor(provider?: YouTubeSearchProvider) {
    this.provider =
      provider ??
      (config.youtube.searchProvider === "api" && config.youtube.apiKey
        ? new YouTubeDataApiProvider()
        : new YtDlpSearchProvider());
  }

  async searchMusic(query: string, limit = 10): Promise<NormalizedYouTubeResult[]> {
    return this.search(`${query}`, limit, "music");
  }

  async searchVideo(query: string, limit = 10): Promise<NormalizedYouTubeResult[]> {
    return this.search(query, limit, "video");
  }

  private async search(query: string, limit: number, scope: "music" | "video"): Promise<NormalizedYouTubeResult[]> {
    const cacheKey = `yt:search:${scope}:${query.toLowerCase().trim()}:${limit}`;
    const cached = await cacheGet<NormalizedYouTubeResult[]>(cacheKey);
    if (cached) return cached;

    const results = await this.provider.search(query, limit);
    await cacheSet(cacheKey, results, config.youtube.searchCacheTtlSeconds);
    return results;
  }
}

export const youtubeSearchService = new YouTubeSearchService();
export * from "./types";
