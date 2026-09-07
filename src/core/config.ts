import { z } from "zod";

/**
 * Central, validated application configuration.
 *
 * Every secret / tunable is read from environment variables (see .env.example).
 * Nothing here is hardcoded. Missing optional integrations degrade gracefully
 * (the feature reports a clear configuration error to the user instead of
 * pretending to work) instead of crashing the whole application.
 */

const csvInts = (value: string | undefined): number[] =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),

  // --- Telegram ---
  BOT_TOKEN: z.string().optional().default(""),
  WEBHOOK_SECRET: z.string().optional().default(""),
  PUBLIC_BASE_URL: z.string().optional().default(""),
  ADMIN_IDS: z.string().optional().default(""),

  // --- Database / Cache ---
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional().default(""),

  // --- Music recognition ---
  MUSIC_PROVIDER: z.string().optional().default("audd"),
  MUSIC_API_KEY: z.string().optional().default(""),
  MUSIC_API_BASE_URL: z.string().optional().default("https://api.audd.io/"),
  RECOGNITION_SAMPLE_SECONDS: z.coerce.number().int().positive().default(12),
  RECOGNITION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),

  // --- YouTube search ---
  YOUTUBE_SEARCH_PROVIDER: z.string().optional().default("ytdlp"),
  YOUTUBE_API_KEY: z.string().optional().default(""),
  YOUTUBE_SEARCH_CACHE_TTL: z.coerce.number().int().positive().default(600),

  // --- Object storage (optional, future scaling) ---
  S3_ENDPOINT: z.string().optional().default(""),
  S3_ACCESS_KEY: z.string().optional().default(""),
  S3_SECRET_KEY: z.string().optional().default(""),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),

  // --- Limits ---
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAX_VIDEO_DURATION: z.coerce.number().int().positive().default(60 * 20),
  MAX_GLOBAL_DOWNLOADS: z.coerce.number().int().positive().default(5),
  MAX_USER_DOWNLOADS: z.coerce.number().int().positive().default(2),
  MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  MAX_DOWNLOADS_PER_DAY: z.coerce.number().int().positive().default(60),
  MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  // --- Storage / lifecycle ---
  TEMP_DIR: z.string().optional().default("/tmp/mediaflow"),
  TEMP_FILE_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // --- Observability ---
  LOG_LEVEL: z.string().optional().default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check your .env file.");
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",

  telegram: {
    botToken: env.BOT_TOKEN,
    webhookSecret: env.WEBHOOK_SECRET,
    publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/$/, ""),
    adminIds: new Set(csvInts(env.ADMIN_IDS)),
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL || "",
  },

  music: {
    provider: env.MUSIC_PROVIDER,
    apiKey: env.MUSIC_API_KEY,
    baseUrl: env.MUSIC_API_BASE_URL,
    sampleSeconds: env.RECOGNITION_SAMPLE_SECONDS,
    maxAttempts: env.RECOGNITION_MAX_ATTEMPTS,
  },

  youtube: {
    searchProvider: env.YOUTUBE_SEARCH_PROVIDER,
    apiKey: env.YOUTUBE_API_KEY,
    searchCacheTtlSeconds: env.YOUTUBE_SEARCH_CACHE_TTL,
  },

  s3: {
    endpoint: env.S3_ENDPOINT,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    get isConfigured() {
      return Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.S3_BUCKET);
    },
  },

  limits: {
    maxFileSizeBytes: env.MAX_FILE_SIZE,
    maxVideoDurationSeconds: env.MAX_VIDEO_DURATION,
    maxGlobalDownloads: env.MAX_GLOBAL_DOWNLOADS,
    maxUserConcurrentDownloads: env.MAX_USER_DOWNLOADS,
    maxRequestsPerMinute: env.MAX_REQUESTS_PER_MINUTE,
    maxDownloadsPerDay: env.MAX_DOWNLOADS_PER_DAY,
    maxRetries: env.MAX_RETRIES,
  },

  storage: {
    tempDir: env.TEMP_DIR,
    tempFileTtlMinutes: env.TEMP_FILE_TTL_MINUTES,
  },

  logLevel: env.LOG_LEVEL,
} as const;

export type AppConfig = typeof config;

export function isAdmin(telegramId: number): boolean {
  return config.telegram.adminIds.has(telegramId);
}
