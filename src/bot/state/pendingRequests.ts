import { randomUUID } from "node:crypto";

/**
 * Short-lived in-memory registry mapping a compact id -> full URL.
 * Needed because Telegram callback_data is capped at 64 bytes and URLs can
 * be much longer (e.g. YouTube links with tracking parameters).
 */
interface PendingEntry {
  userId: string;
  url: string;
  expiresAt: number;
}

const store = new Map<string, PendingEntry>();
const TTL_MS = 10 * 60_000;

export function registerPendingUrl(userId: string, url: string): string {
  const id = randomUUID().slice(0, 8);
  store.set(id, { userId, url, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function resolvePendingUrl(id: string, userId: string): string | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null; // ownership check
  return entry.url;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(id);
  }
}, 5 * 60_000);
