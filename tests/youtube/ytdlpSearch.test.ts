import { describe, it, expect, vi, beforeEach } from "vitest";

const runProcessMock = vi.fn();
vi.mock("@/services/security/exec", () => ({
  runProcess: (...args: unknown[]) => runProcessMock(...args),
}));

import { YtDlpSearchProvider } from "@/services/youtube/ytdlpSearch";

describe("YtDlpSearchProvider", () => {
  beforeEach(() => runProcessMock.mockReset());

  it("normalizes yt-dlp flat-playlist search results", async () => {
    const sampleEntries = {
      entries: [
        {
          id: "abc123",
          title: "Do You Mind",
          channel: "Kygo",
          duration: 180,
          thumbnails: [{ url: "https://i.ytimg.com/vi/abc123/small.jpg", width: 120 }, { url: "https://i.ytimg.com/vi/abc123/big.jpg", width: 480 }],
          view_count: 1000,
          upload_date: "20200101",
        },
      ],
    };
    runProcessMock.mockReturnValue({ promise: Promise.resolve({ stdout: JSON.stringify(sampleEntries), stderr: "", code: 0 }) });

    const provider = new YtDlpSearchProvider();
    const results = await provider.search("Do You Mind Kygo", 5);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      videoId: "abc123",
      title: "Do You Mind",
      channel: "Kygo",
      duration: 180,
      url: "https://www.youtube.com/watch?v=abc123",
      thumbnail: "https://i.ytimg.com/vi/abc123/big.jpg",
    });
  });

  it("throws a clean error when yt-dlp fails", async () => {
    runProcessMock.mockReturnValue({ promise: Promise.resolve({ stdout: "", stderr: "network error", code: 1 }) });
    const provider = new YtDlpSearchProvider();
    await expect(provider.search("test", 5)).rejects.toThrow("YouTube search failed");
  });

  it("caps requested results at 10", async () => {
    runProcessMock.mockReturnValue({ promise: Promise.resolve({ stdout: JSON.stringify({ entries: [] }), stderr: "", code: 0 }) });
    const provider = new YtDlpSearchProvider();
    await provider.search("test", 50);
    const args = runProcessMock.mock.calls[0][1] as string[];
    expect(args[0]).toBe("ytsearch10:test");
  });
});
