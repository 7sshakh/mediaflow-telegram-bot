import { db } from "@/db";
import { sql } from "drizzle-orm";
import { config } from "@/core/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await db.execute(sql`select 1`);

  const items: Array<{ label: string; ok: boolean; note?: string }> = [
    { label: "PostgreSQL", ok: true },
    { label: "Telegram bot token", ok: Boolean(config.telegram.botToken), note: config.telegram.botToken ? undefined : "set BOT_TOKEN" },
    { label: "Music recognition (AudD)", ok: Boolean(config.music.apiKey), note: config.music.apiKey ? undefined : "set MUSIC_API_KEY" },
    { label: "Redis", ok: Boolean(config.redis.url), note: config.redis.url ? undefined : "optional — using in-memory fallback" },
  ];

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-[0_24px_60px_rgba(16,24,40,0.12)]">
        <p className="m-0 text-sm uppercase tracking-[0.08em] text-slate-600">Telegram Bot</p>
        <h1 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.05] text-slate-950">
          🎬 MediaFlow Bot
        </h1>
        <p className="mt-4 text-base text-slate-700">
          A production Telegram bot for TikTok / Instagram / YouTube downloads, Shazam-class music
          recognition, and YouTube music search — all inside Telegram. This page is only the
          service status dashboard; the actual product experience lives in Telegram.
        </p>

        <ul className="mt-8 space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="font-medium text-slate-800">{item.label}</span>
              <span className={item.ok ? "text-emerald-600" : "text-amber-600"}>
                {item.ok ? "✅ configured" : `⚠️ ${item.note}`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-slate-500">
          Webhook endpoint: <code>/api/telegram</code> · Health check: <code>/api/health</code>
        </p>
      </section>
    </main>
  );
}
