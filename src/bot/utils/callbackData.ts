import { createHmac } from "node:crypto";
import { config } from "@/core/config";

/**
 * Signed, compact callback_data codec.
 *
 * Telegram callback_data is limited to 64 bytes and must NEVER be trusted
 * blindly (Section 51). Every payload we emit is tagged with a short HMAC
 * signature derived from a server-side secret, so a client cannot forge or
 * mutate an action/id pair. Ownership (does this task/download/search
 * belong to the calling user?) is still re-validated against the database
 * on every callback handler on top of this signature check — defense in
 * depth.
 */

const SECRET = config.telegram.botToken || config.telegram.webhookSecret || "mediaflow-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 8);
}

export function encodeCallback(action: string, parts: Array<string | number> = []): string {
  const payload = [action, ...parts.map(String)].join(".");
  const sig = sign(payload);
  const data = `${payload}~${sig}`;
  if (Buffer.byteLength(data, "utf8") > 64) {
    throw new Error(`callback_data too long (${Buffer.byteLength(data, "utf8")} bytes): ${data}`);
  }
  return data;
}

export interface DecodedCallback {
  action: string;
  parts: string[];
}

export function decodeCallback(data: string): DecodedCallback | null {
  const sepIndex = data.lastIndexOf("~");
  if (sepIndex === -1) return null;
  const payload = data.slice(0, sepIndex);
  const sig = data.slice(sepIndex + 1);
  if (sign(payload) !== sig) return null;
  const [action, ...parts] = payload.split(".");
  if (!action) return null;
  return { action, parts };
}
