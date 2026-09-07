import { describe, it, expect, vi, afterEach } from "vitest";
import dns from "node:dns/promises";
import {
  detectPlatform,
  extractFirstUrl,
  canonicalizeUrl,
  validateAndDetectPlatform,
  UrlSecurityError,
} from "@/services/security/url";

describe("detectPlatform", () => {
  it("detects tiktok hosts including short domains", () => {
    expect(detectPlatform("www.tiktok.com")).toBe("tiktok");
    expect(detectPlatform("vm.tiktok.com")).toBe("tiktok");
    expect(detectPlatform("vt.tiktok.com")).toBe("tiktok");
  });

  it("detects instagram and youtube hosts", () => {
    expect(detectPlatform("instagram.com")).toBe("instagram");
    expect(detectPlatform("youtu.be")).toBe("youtube");
    expect(detectPlatform("music.youtube.com")).toBe("youtube");
  });

  it("returns null for unknown domains", () => {
    expect(detectPlatform("evil.example.com")).toBeNull();
    expect(detectPlatform("tiktok.com.evil.com")).toBeNull();
  });
});

describe("extractFirstUrl", () => {
  it("extracts the first http(s) url from free text", () => {
    expect(extractFirstUrl("check this out https://vt.tiktok.com/abc123 nice")).toBe(
      "https://vt.tiktok.com/abc123",
    );
  });

  it("returns null when there is no url", () => {
    expect(extractFirstUrl("hello world")).toBeNull();
  });
});

describe("canonicalizeUrl", () => {
  it("strips tracking params and trailing slash", () => {
    const canon = canonicalizeUrl(new URL("https://WWW.TikTok.com/@user/video/123/?utm_source=x"));
    expect(canon).toBe("https://www.tiktok.com/@user/video/123");
  });
});

describe("validateAndDetectPlatform", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects non-http protocols", async () => {
    await expect(validateAndDetectPlatform("ftp://tiktok.com/video")).rejects.toBeInstanceOf(UrlSecurityError);
  });

  it("rejects unsupported domains", async () => {
    await expect(validateAndDetectPlatform("https://example.com/video")).rejects.toMatchObject({
      code: "UNSUPPORTED_DOMAIN",
    });
  });

  it("rejects malformed urls", async () => {
    await expect(validateAndDetectPlatform("not a url")).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("blocks domains resolving to private IP ranges (SSRF protection)", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    await expect(validateAndDetectPlatform("https://www.tiktok.com/@user/video/123")).rejects.toMatchObject({
      code: "PRIVATE_NETWORK_BLOCKED",
    });
  });

  it("accepts a valid public tiktok url", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);
    const result = await validateAndDetectPlatform("https://www.tiktok.com/@user/video/123");
    expect(result.platform).toBe("tiktok");
  });

  it("blocks localhost outright without a DNS lookup", async () => {
    await expect(validateAndDetectPlatform("https://localhost/video")).rejects.toMatchObject({
      code: "PRIVATE_NETWORK_BLOCKED",
    });
  });
});
