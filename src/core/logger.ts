import pino from "pino";
import { config } from "./config";

/**
 * Structured, secret-safe logger.
 * Never log tokens, API keys or full URLs with credentials.
 */
export const logger = pino({
  level: config.logLevel || "info",
  redact: {
    paths: [
      "botToken",
      "*.botToken",
      "apiKey",
      "*.apiKey",
      "api_token",
      "*.api_token",
      "authorization",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  base: { service: "mediaflow-bot" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
