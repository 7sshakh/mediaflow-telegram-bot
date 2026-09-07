import { config } from "@/core/config";
import type { MusicRecognitionProvider } from "./base";
import { AudDProvider } from "./audd";

/**
 * Provider factory. To add a new provider, implement MusicRecognitionProvider
 * and register it here — nothing else in the app needs to change.
 */
const providers: Record<string, () => MusicRecognitionProvider> = {
  audd: () => new AudDProvider(),
};

export function getMusicProvider(): MusicRecognitionProvider {
  const factory = providers[config.music.provider] ?? providers.audd;
  return factory();
}

export * from "./base";
