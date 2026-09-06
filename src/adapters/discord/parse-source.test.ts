import { describe, expect, it } from "vitest";
import { isDiscordChannelIndex, isDiscordMessageArray, normalizeDiscordTimestamp } from "./parse-source.js";

describe("normalizeDiscordTimestamp", () => {
  it("converts Discord's UTC timestamp format to ISO 8601", () => {
    expect(normalizeDiscordTimestamp("2024-02-01 09:00:00")).toBe("2024-02-01T09:00:00.000Z");
  });

  it("returns undefined for missing or malformed values", () => {
    expect(normalizeDiscordTimestamp(undefined)).toBeUndefined();
    expect(normalizeDiscordTimestamp("not a timestamp")).toBeUndefined();
  });
});

describe("isDiscordChannelIndex", () => {
  it("accepts an object mapping id to string label", () => {
    expect(isDiscordChannelIndex({ "1": "general" })).toBe(true);
    expect(isDiscordChannelIndex({})).toBe(true);
  });

  it("rejects arrays and non-string values", () => {
    expect(isDiscordChannelIndex([])).toBe(false);
    expect(isDiscordChannelIndex({ "1": 42 })).toBe(false);
    expect(isDiscordChannelIndex(null)).toBe(false);
  });
});

describe("isDiscordMessageArray", () => {
  it("accepts an array of message-shaped objects", () => {
    expect(isDiscordMessageArray([{ ID: "1", Timestamp: "x" }])).toBe(true);
    expect(isDiscordMessageArray([])).toBe(true);
  });

  it("rejects non-arrays and unrelated shapes", () => {
    expect(isDiscordMessageArray({})).toBe(false);
    expect(isDiscordMessageArray([{ foo: "bar" }])).toBe(false);
  });
});
