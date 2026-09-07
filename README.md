# 🎬 MediaFlow Bot

A production-grade Telegram bot that downloads public media from **TikTok, Instagram and
YouTube**, identifies the music playing in any downloaded video (Shazam-class recognition),
and searches YouTube for up to 10 matching results — all inside Telegram.

> ⚠️ **Runtime note.** This project was built inside a sandboxed **Next.js + PostgreSQL +
> Node.js** application platform (the tools available only run/validate Next.js apps — there is
> no Python/Celery/Docker runtime in the build environment). To deliver a fully working, real
> (non-mocked) system on that platform, the bot layer is implemented in **TypeScript with
> [grammY](https://grammy.dev)** instead of aiogram, and the "queue/worker" tier is an
> in-process, concurrency-limited job scheduler that is Redis-ready (it transparently upgrades
> to Redis for rate-limiting/caching when `REDIS_URL` is set). Every functional requirement
> from the spec (real downloads via yt-dlp, real FFmpeg processing, real AudD music
> recognition, real YouTube search, real Postgres persistence, real SSRF/security hardening)
> is implemented for real — nothing is mocked. Docker/Compose files are included for standalone
> VPS deployment outside of this platform.

---

## 1. Features

- **Multi-platform downloader** — TikTok, Instagram (public posts/reels), YouTube & Shorts,
  via a pluggable `PlatformDownloader` interface (adding Facebook/Twitter/SoundCloud later is a
  ~30 line change, see `src/services/downloader/base.ts`).
- **Music recognition** — extracts short audio samples with FFmpeg (middle → start → end of the
  clip) and identifies the track via [AudD](https://audd.io) (a real, keyed, Shazam-class API).
  Every attempt is a genuine API call; if several distinct songs are detected across attempts
  they are all shown as real candidates (never fabricated data).
- **YouTube search** — up to 10 results with thumbnail, title, channel, duration; zero-config
  via `yt-dlp`'s search extractor, or the official YouTube Data API v3 when `YOUTUBE_API_KEY`
  is configured.
- **Telegram-native UX** — inline keyboards, message editing instead of spam, throttled real
  download progress bars, cancel button, 🇺🇿/🇷🇺/🇬🇧 localisation.
- **Security first** — strict URL allow-listing, SSRF protection (DNS-resolves every host and
  blocks private/loopback/link-local ranges), zero shell string concatenation (`execFile`/`spawn`
  with argument arrays only), signed callback data, ownership checks on every callback.
- **Abuse protection** — per-user requests/minute + daily download caps, per-user and global
  concurrent-download limits, all Redis-backed with an automatic in-memory fallback.
- **Zero-mock policy** — if `MUSIC_API_KEY` (or any other integration key) is missing, the
  feature clearly tells the user/admin it isn't configured instead of faking a result.
- **Admin panel** — `/admin` with live statistics, user blocking, cleanup, system status.
- **Privacy by design** — downloaded media is never permanently stored; temp folders are
  per-task UUID directories that are deleted right after delivery, plus a background sweep for
  anything abandoned beyond `TEMP_FILE_TTL_MINUTES`. Only metadata is persisted in Postgres.

## 2. Architecture

```
Telegram Update
      │
      ▼
Webhook  (/api/telegram, HMAC secret-token verified)
      │
      ▼
grammY Bot (src/bot) ── i18n / rate-limit / user middlewares
      │
      ▼
Download pipeline (src/services/pipeline) ── never blocks the update handler
      │
      ├─ URL security & SSRF validation  (services/security/url.ts)
      ├─ Concurrency-limited queue        (services/queue/downloadQueue.ts)
      ├─ yt-dlp (argv array, no shell)    (services/downloader/*)
      ├─ FFmpeg probing/extraction/transcode (services/media/ffmpeg.ts)
      └─ Telegram upload + Postgres bookkeeping
      │
      ▼
🔎 Music button → AudD recognition (services/music) → YouTube search (services/youtube)
```

### Project layout

```
src/
  app/
    api/
      telegram/route.ts        # Telegram webhook (POST) — signature-checked
      telegram/setup/route.ts  # one-time webhook registration (secret-protected)
      health/route.ts          # DB / Redis / queue / config health check
  bot/
    handlers/                  # start, help, download, music, youtube, settings, admin...
    keyboards/                 # InlineKeyboardMarkup builders
    i18n/                      # uz / ru / en dictionaries
    middlewares/               # user context, blocking, rate limiting
    services/                  # deliverMedia orchestration, status-message editing
    state/                     # short-lived pending-request registry
    utils/                     # signed callback_data codec, error mapping
  services/
    downloader/                # PlatformDownloader interface + yt-dlp backed implementations
    media/ffmpeg.ts            # probing, audio extraction, safe transcoding
    music/                     # MusicRecognitionProvider interface + AudD + smart engine
    youtube/                   # YouTubeSearchProvider interface + yt-dlp/Data API + cache
    queue/                     # concurrency-limited scheduler + cancellation registry
    ratelimit/                 # Redis-or-memory sliding window limiter
    cache/                     # Redis-or-memory cache (search result caching)
    security/                  # URL allow-list + SSRF guard, secure subprocess runner
    storage/                   # per-task temp dirs + abandoned-file sweeper
    pipeline/                  # end-to-end download orchestration + task bookkeeping
  db/
    schema.ts                  # users, tasks, downloads, music_recognitions, youtube_searches,
                                # admin_actions, settings
    repo/                      # typed repository functions per table
  core/                        # env validation (zod), structured logger (pino)
tests/                         # vitest unit tests (URL security, callback codec, YouTube
                                # normalization, rate limiter, temp-file cleanup)
```

## 3. How the core flow works

1. User sends a link → `services/security/url.ts` validates protocol, domain allow-list, and
   resolves DNS to block SSRF against private/internal networks.
2. `deliverMediaForUrl` sends **immediate feedback** ("🔎 Checking link...") and edits that same
   message as the state changes (checking → platform detected → downloading w/ live progress →
   ready), never spamming new messages.
3. The actual job runs through `enqueueJob` (global concurrency limit, extra jobs queue
   automatically) so the Telegram handler never blocks.
4. `yt-dlp` downloads with `--max-filesize`, retries, socket timeouts, and a machine-readable
   `--progress-template` that is parsed into a real progress bar (throttled edits).
5. FFmpeg ensures the result is Telegram-compatible (only transcodes when actually necessary).
6. The bot uploads the file, stores only **metadata + the returned Telegram `file_id`** in
   Postgres, and deletes the temp directory. If the exact same public URL is requested again,
   the cached `file_id` is reused instantly — no re-download.
7. Every delivered video/audio has a **🔎 Music** button. Tapping it fetches the file back from
   Telegram's CDN (via `file_id`), extracts short samples with FFmpeg, and asks AudD to
   recognize the track — trying multiple segments if the first fails.
8. On a match, the bot automatically searches YouTube for `"<title> <artist>"` and shows up to
   10 results with thumbnail/title/channel/duration and ▶️ Open / 🎵 Audio / 🎬 Video actions.

## 4. Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 14+
- `yt-dlp` and `ffmpeg`/`ffprobe` available on `PATH`
- (optional but recommended) Redis for multi-instance rate limiting/caching
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An [AudD](https://audd.io) API token for music recognition (free tier available)

```bash
# System dependencies (Debian/Ubuntu example)
sudo apt-get update && sudo apt-get install -y ffmpeg
pip3 install --break-system-packages yt-dlp

# App dependencies
npm install
cp .env.example .env   # fill in BOT_TOKEN, MUSIC_API_KEY, ADMIN_IDS, ...

# Database
npx drizzle-kit push
```

### Run locally (webhook via a tunnel, e.g. ngrok/cloudflared)

```bash
npm run build && npm start
# expose the app publicly, e.g.: cloudflared tunnel --url http://localhost:3000
# then set PUBLIC_BASE_URL and WEBHOOK_SECRET in .env and call:
curl "https://your-tunnel-domain/api/telegram/setup?secret=$WEBHOOK_SECRET"
```

### Run tests

```bash
npx vitest run
```

## 5. Deployment (Docker / VPS)

```bash
cp .env.example .env   # fill in real secrets
docker compose up -d --build
# after the stack is healthy, register the webhook:
curl "https://your-domain.com/api/telegram/setup?secret=$WEBHOOK_SECRET"
```

Put `nginx.conf.example` in front of the `app` service for TLS termination on a bare VPS, or
terminate TLS at your platform's load balancer.

## 6. Configuration reference

See `.env.example` for the full list. Highlights:

| Variable | Purpose |
|---|---|
| `BOT_TOKEN` | Telegram bot token (required to start the bot) |
| `WEBHOOK_SECRET` | Random secret validated on every incoming webhook request |
| `ADMIN_IDS` | Comma-separated Telegram user IDs allowed to use `/admin` |
| `MUSIC_API_KEY` | AudD API token — recognition is disabled (with a clear message) without it |
| `YOUTUBE_SEARCH_PROVIDER` | `ytdlp` (default, keyless) or `api` (YouTube Data API v3) |
| `MAX_FILE_SIZE` / `MAX_VIDEO_DURATION` | Hard limits enforced before and during download |
| `MAX_GLOBAL_DOWNLOADS` / `MAX_USER_DOWNLOADS` | Concurrency caps |
| `MAX_REQUESTS_PER_MINUTE` / `MAX_DOWNLOADS_PER_DAY` | Anti-abuse rate limits |
| `REDIS_URL` | Optional — enables cross-instance rate limiting/caching |
| `TEMP_DIR` / `TEMP_FILE_TTL_MINUTES` | Temp file location and abandoned-file TTL |

## 7. Security notes

- Every user-supplied URL passes a strict domain allow-list **and** a DNS-based SSRF check
  before it is ever handed to `yt-dlp`.
- All subprocess calls (`yt-dlp`, `ffmpeg`, `ffprobe`) use `spawn`/argument arrays — **never**
  `shell: true` or string concatenation.
- Telegram `callback_data` is HMAC-signed (`src/bot/utils/callbackData.ts`) and every handler
  re-validates that the referenced task/download/recognition/search row actually belongs to the
  calling Telegram user before acting on it.
- Temp directories are per-task random UUIDs; deletion is scoped so a bug can never delete
  anything outside the configured temp root (see `services/storage/tempStorage.ts`).
- Errors shown to users are always short, translated, human messages — never stack traces or
  internal paths.

## 8. Extensibility

- **New source platform**: implement `PlatformDownloader`, add its domains to the allow-list in
  `services/security/url.ts`. The queue, FFmpeg pipeline, Telegram delivery and music button all
  keep working unmodified.
- **New music provider**: implement `MusicRecognitionProvider` and register it in
  `services/music/index.ts`.
- **New YouTube search backend**: implement `YouTubeSearchProvider` and wire it into
  `services/youtube/search.ts`.
- **Premium plans**: `users.plan` (`free` / `premium` / `admin`) already exists in the schema;
  wire higher limits/priority queueing into `services/ratelimit` and `services/queue` when ready.

## 9. Known limitations of this environment

- TikTok/Instagram extraction quality depends entirely on `yt-dlp`'s upstream extractors, which
  change frequently as those platforms update their apps — keep `yt-dlp` up to date in
  production (`pip install -U yt-dlp`).
- The in-process queue is per-instance; for true multi-instance horizontal scaling, swap
  `services/queue/downloadQueue.ts` for a Redis/BullMQ-backed worker pool (the interface is
  already isolated for that purpose).
