export interface NormalizedYouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  duration: number | null; // seconds
  thumbnail: string;
  url: string;
  viewCount?: number | null;
  uploadedAt?: string | null;
}

export interface YouTubeSearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<NormalizedYouTubeResult[]>;
}
