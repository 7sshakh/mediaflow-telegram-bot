import { describe, it, expect } from "vitest";
import { encodeCallback, decodeCallback } from "@/bot/utils/callbackData";

describe("callback data codec", () => {
  it("round-trips action and parts", () => {
    const data = encodeCallback("music", ["abc-123"]);
    const decoded = decodeCallback(data);
    expect(decoded).toEqual({ action: "music", parts: ["abc-123"] });
  });

  it("rejects tampered payloads", () => {
    const data = encodeCallback("cancel", ["task-1"]);
    const tampered = data.replace("task-1", "task-2");
    expect(decodeCallback(tampered)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(decodeCallback("not-a-valid-payload")).toBeNull();
    expect(decodeCallback("")).toBeNull();
  });

  it("throws when the encoded payload would exceed Telegram's 64 byte limit", () => {
    const huge = "x".repeat(100);
    expect(() => encodeCallback("action", [huge])).toThrow();
  });
});
