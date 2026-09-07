import { config } from "@/core/config";
import type { NormalizedYouTubeResult, YouTubeSearchProvider } from "./types";

/**
 * Optional YouTube Data API v3 provider — used automatically when
 * YOUTUBE_API_KEY is configured and YOUTUBE_SEARCH_PROVIDER=api. Provides
 * official quota-managed search plus accurate durations via videos.list.
 */
export class YouTubeDataApiProvider implements YouTubeSearchProvider {
  readonly name = "youtube_data_api";

  async search(query: string, limit: number): Promise<NormalizedYouTubeResult[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 10);
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(safeLimit));
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("key", config.youtube.apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) throw new Error(`YouTube Data API search failed (${searchRes.status})`);
    const searchJson = await searchRes.json();
    const items: Array<{ id: { videoId: string }; snippet: Record<string, unknown> }> = searchJson.items ?? [];
    const ids = items.map((i) => i.id.videoId).filter(Boolean);
    if (ids.length === 0) return [];

    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "contentDetails,statistics");
    videosUrl.searchParams.set("id", ids.join(","));
    videosUrl.searchParams.set("key", config.youtube.apiKey);
    const videosRes = await fetch(videosUrl.toString());
    const videosJson = videosRes.ok ? await videosRes.json() : { items: [] };
    const durationById = new Map<string, number>();
    const viewsById = new Map<string, number>();
    for (const v of videosJson.items ?? []) {
      durationById.set(v.id, parseIsoDuration(v.contentDetails?.duration ?? "PT0S"));
      viewsById.set(v.id, Number(v.statistics?.viewCount ?? 0));
    }

    return items.map((item) => {
      const snippet = item.snippet as {
        title: string;
        channelTitle: string;
        thumbnails: Record<string, { url: string }>;
        publishedAt: string;
      };
      const videoId = item.id.videoId;
      return {
        videoId,
        title: snippet.title,
        channel: snippet.channelTitle,
        duration: durationById.get(videoId) ?? null,
        thumbnail:
          snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        viewCount: viewsById.get(videoId) ?? null,
        uploadedAt: snippet.publishedAt,
      };
    });
  }
}

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0);
}
