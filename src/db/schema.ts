import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * MediaFlow Bot database schema.
 *
 * IDs are application-generated UUID strings (crypto.randomUUID()) so we
 * never depend on a specific Postgres extension being installed.
 */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
    username: text("username"),
    firstName: text("first_name"),
    languageCode: varchar("language_code", { length: 5 }).notNull().default("en"),
    role: varchar("role", { length: 20 }).notNull().default("user"), // user | admin
    plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | premium | admin
    isBlocked: boolean("is_blocked").notNull().default(false),
    settings: jsonb("settings")
      .$type<{
        audioQuality?: "128" | "192" | "320";
        videoQuality?: "best" | "1080" | "720" | "480";
        defaultMediaType?: "video" | "audio";
        notifications?: boolean;
      }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_telegram_id_idx").on(table.telegramId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(), // download | recognize | youtube_search
    url: text("url"),
    platform: varchar("platform", { length: 20 }),
    status: varchar("status", { length: 20 }).notNull().default("QUEUED"),
    progress: integer("progress").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.userId),
    index("tasks_status_idx").on(table.status),
  ],
);

export const downloads = pgTable(
  "downloads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    mediaType: varchar("media_type", { length: 10 }).notNull().default("video"), // video | audio
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
    title: text("title"),
    author: text("author"),
    durationSec: integer("duration_sec"),
    width: integer("width"),
    height: integer("height"),
    filesizeBytes: bigint("filesize_bytes", { mode: "number" }),
    telegramFileId: text("telegram_file_id"),
    telegramFileType: varchar("telegram_file_type", { length: 10 }),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("downloads_user_id_idx").on(table.userId),
    index("downloads_canonical_url_idx").on(table.canonicalUrl),
    index("downloads_platform_idx").on(table.platform),
  ],
);

export const musicRecognitions = pgTable(
  "music_recognitions",
  {
    id: text("id").primaryKey(),
    downloadId: text("download_id").references(() => downloads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    matched: boolean("matched").notNull().default(false),
    title: text("title"),
    artist: text("artist"),
    album: text("album"),
    releaseDate: text("release_date"),
    coverUrl: text("cover_url"),
    isrc: text("isrc"),
    appleMusicUrl: text("apple_music_url"),
    spotifyUrl: text("spotify_url"),
    youtubeQuery: text("youtube_query"),
    confidence: integer("confidence"),
    candidates: jsonb("candidates").$type<
      Array<{
        title: string;
        artist: string;
        album?: string;
        coverUrl?: string;
        appleMusicUrl?: string;
        spotifyUrl?: string;
      }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("music_recognitions_download_id_idx").on(table.downloadId)],
);

export const youtubeSearches = pgTable(
  "youtube_searches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    resultsJson: jsonb("results_json").$type<
      Array<{
        videoId: string;
        title: string;
        channel: string;
        duration: number | null;
        thumbnail: string;
        url: string;
      }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("youtube_searches_user_id_idx").on(table.userId)],
);

export const adminActions = pgTable(
  "admin_actions",
  {
    id: text("id").primaryKey(),
    adminTelegramId: bigint("admin_telegram_id", { mode: "number" }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    targetUserId: bigint("target_user_id", { mode: "number" }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_actions_admin_idx").on(table.adminTelegramId)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").$type<unknown>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
