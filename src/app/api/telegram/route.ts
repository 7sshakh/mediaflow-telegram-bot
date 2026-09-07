import { webhookCallback } from "grammy";
import { NextResponse, type NextRequest } from "next/server";
import { getBot } from "@/bot/bot";
import { config } from "@/core/config";
import { logger } from "@/core/logger";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook endpoint. Every update is validated against the secret
 * token Telegram sends in the `X-Telegram-Bot-Api-Secret-Token` header
 * (set when the webhook is registered), preventing spoofed updates from
 * being processed.
 */
export async function POST(req: NextRequest) {
  if (!config.telegram.botToken) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN is not configured" }, { status: 503 });
  }

  if (config.telegram.webhookSecret) {
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== config.telegram.webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const bot = getBot();
    const handler = webhookCallback(bot, "std/http", { timeoutMilliseconds: 25_000, onTimeout: "return" });
    return await handler(req);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "telegram_webhook_error");
    return NextResponse.json({ ok: false }, { status: 200 }); // ack to Telegram to avoid update storms
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "mediaflow-telegram-webhook" });
}
