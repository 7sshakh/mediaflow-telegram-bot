import { DownloadError } from "@/services/downloader/ytdlp";
import { UrlSecurityError } from "@/services/security/url";
import { t, type Locale } from "@/bot/i18n/locales";
import { config } from "@/core/config";

/** Maps internal errors to short, user-facing, translated messages. Never leaks stack traces. */
export function errorMessageFor(locale: Locale, err: unknown): string {
  if (err instanceof UrlSecurityError) {
    switch (err.code) {
      case "INVALID_URL":
        return t(locale, "error_invalid_url");
      case "UNSUPPORTED_PROTOCOL":
      case "UNSUPPORTED_DOMAIN":
        return t(locale, "error_unsupported_domain");
      case "PRIVATE_NETWORK_BLOCKED":
      case "DNS_RESOLUTION_FAILED":
        return t(locale, "error_private_network");
    }
  }
  if (err instanceof DownloadError) {
    switch (err.code) {
      case "TOO_LONG":
        return t(locale, "error_too_long", { limit: String(Math.round(config.limits.maxVideoDurationSeconds / 60)) });
      case "TOO_LARGE":
        return t(locale, "error_too_large");
      case "CANCELLED":
        return t(locale, "status_cancelled");
      case "PRIVATE":
      case "GEO_RESTRICTED":
      case "UNAVAILABLE":
      case "TIMEOUT":
      case "UNKNOWN":
      default:
        return t(locale, "error_unavailable");
    }
  }
  return t(locale, "error_generic", { reason: t(locale, "error_unavailable") });
}
