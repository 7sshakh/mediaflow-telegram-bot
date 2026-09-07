import { NextResponse, type NextRequest } from "next/server";
import { getBot } from "@/bot/bot";
import { config } from "@/core/config";
import { logger } from "@/core/logger";

export const dynamic = "force-dynamic";

/**
 * One-time webhook registration endpoint, protected by WEBHOOK_SECRET.
 * Call: GET /api/telegram/setup?secret=<WEBHOOK_SECRET>
 * Requires PUBLIC_BASE_URL to be configured to the bot's public HTTPS URL.
 */
export async function GET(req: NextRequest) {
  if (!config.telegram.botToken) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN is not configured" }, { status: 503 });
  }
  if (!config.telegram.publicBaseUrl) {
    return NextResponse.json({ ok: false, error: "PUBLIC_BASE_URL is not configured" }, { status: 503 });
  }

  const secret = req.nextUrl.searchParams.get("secret");
  if (!config.telegram.webhookSecret || secret !== config.telegram.webhookSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const bot = getBot();
    const webhookUrl = `${config.telegram.publicBaseUrl}/api/telegram`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.telegram.webhookSecret,
      drop_pending_updates: true,
    });
    logger.info({ webhookUrl }, "webhook_registered");
    return NextResponse.json({ ok: true, webhookUrl });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "webhook_setup_failed");
    return NextResponse.json({ ok: false, error: "failed to set webhook" }, { status: 500 });
  }
}
