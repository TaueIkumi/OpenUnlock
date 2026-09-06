import { describe, expect, it } from "vitest";
import { shortId, checksum } from "./hashing.js";

describe("shortId", () => {
  it("is deterministic for the same input", () => {
    expect(shortId("chatgpt", "conv-1")).toBe(shortId("chatgpt", "conv-1"));
  });

  it("differs for different input", () => {
    expect(shortId("chatgpt", "conv-1")).not.toBe(shortId("chatgpt", "conv-2"));
  });

  it("returns an 8-character hex string", () => {
    expect(shortId("a", "b")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("checksum", () => {
  it("is deterministic and matches sha256", () => {
    expect(checksum("hello")).toBe(checksum("hello"));
    expect(checksum("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
