import dns from "node:dns/promises";
import net from "node:net";

/**
 * Strict URL / SSRF security module.
 *
 * Every user-supplied URL is:
 *   1. parsed with the WHATWG URL parser (never regex/string concatenation)
 *   2. restricted to http/https
 *   3. restricted to an explicit per-platform domain allow-list
 *   4. resolved via DNS and checked against private / loopback / link-local /
 *      reserved IP ranges to prevent SSRF against internal infrastructure.
 *
 * This module never itself fetches the URL. Downloading is always delegated
 * to yt-dlp (a hardened, well-audited tool) invoked with an argument array
 * (never a shell string), and only for URLs that passed this validation.
 */

export type Platform = "tiktok" | "instagram" | "youtube";

const PLATFORM_HOST_ALLOWLIST: Record<Platform, string[]> = {
  tiktok: [
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
  ],
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  youtube: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
  ],
};

export class UrlSecurityError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "UNSUPPORTED_PROTOCOL"
      | "UNSUPPORTED_DOMAIN"
      | "PRIVATE_NETWORK_BLOCKED"
      | "DNS_RESOLUTION_FAILED",
  ) {
    super(message);
    this.name = "UrlSecurityError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // "this" network
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6
    return isPrivateIPv4(lower.replace("::ffff:", ""));
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // unknown format -> treat as unsafe
}

function hostMatchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function detectPlatform(hostname: string): Platform | null {
  const host = hostname.toLowerCase();
  for (const platform of Object.keys(PLATFORM_HOST_ALLOWLIST) as Platform[]) {
    if (hostMatchesAllowlist(host, PLATFORM_HOST_ALLOWLIST[platform])) return platform;
  }
  return null;
}

/** Extract the first http(s) URL from an arbitrary text message. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}

export interface ValidatedUrl {
  url: URL;
  platform: Platform;
}

/**
 * Validate a user-supplied URL for security and platform support.
 * Throws UrlSecurityError on any violation.
 */
export async function validateAndDetectPlatform(rawUrl: string): Promise<ValidatedUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlSecurityError("Malformed URL", "INVALID_URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlSecurityError("Only http/https URLs are allowed", "UNSUPPORTED_PROTOCOL");
  }

  // Reject literal IP addresses / obvious internal hostnames outright, before
  // even checking the platform allow-list.
  const lowerHost = url.hostname.toLowerCase();
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal") ||
    net.isIP(lowerHost)
  ) {
    throw new UrlSecurityError("Blocked host", "PRIVATE_NETWORK_BLOCKED");
  }

  const platform = detectPlatform(url.hostname);
  if (!platform) {
    throw new UrlSecurityError("Unsupported domain", "UNSUPPORTED_DOMAIN");
  }

  // Resolve DNS and ensure none of the resolved addresses are private/internal.
  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: false });
    if (records.length === 0) {
      throw new UrlSecurityError("DNS resolution returned no records", "DNS_RESOLUTION_FAILED");
    }
    for (const record of records) {
      if (isPrivateIP(record.address)) {
        throw new UrlSecurityError(
          "Domain resolves to a private/internal network address",
          "PRIVATE_NETWORK_BLOCKED",
        );
      }
    }
  } catch (err) {
    if (err instanceof UrlSecurityError) throw err;
    throw new UrlSecurityError("Could not resolve host", "DNS_RESOLUTION_FAILED");
  }

  return { url, platform };
}

/** Build a canonical cache key for a URL (strips tracking params, trailing slash). */
export function canonicalizeUrl(url: URL): string {
  const clone = new URL(url.toString());
  const stripParams = ["utm_source", "utm_medium", "utm_campaign", "is_from_webapp", "sender_device", "_r"];
  for (const p of stripParams) clone.searchParams.delete(p);
  clone.hash = "";
  let str = clone.toString();
  if (str.endsWith("/")) str = str.slice(0, -1);
  return str.toLowerCase();
}
