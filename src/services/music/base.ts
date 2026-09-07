export interface RecognitionResult {
  title: string;
  artist: string;
  album?: string | null;
  releaseDate?: string | null;
  coverUrl?: string | null;
  isrc?: string | null;
  confidence?: number | null;
  appleMusicUrl?: string | null;
  spotifyUrl?: string | null;
  youtubeSearchQuery: string;
}

/**
 * Provider-agnostic music recognition interface. Concrete providers (AudD
 * today, others tomorrow) only need to implement `recognize`.
 */
export interface MusicRecognitionProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  recognize(audioFilePath: string): Promise<RecognitionResult | null>;
}

export class MusicProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Music recognition provider "${provider}" is not configured (missing API key).`);
    this.name = "MusicProviderNotConfiguredError";
  }
}
