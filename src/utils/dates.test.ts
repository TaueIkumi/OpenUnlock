import { describe, expect, it } from "vitest";
import { normalizeTimestamp, isoDatePart } from "./dates.js";

describe("normalizeTimestamp", () => {
  it("normalizes unix epoch seconds", () => {
    expect(normalizeTimestamp(1700000000)).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("normalizes ISO strings", () => {
    expect(normalizeTimestamp("2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns undefined for null/undefined/invalid input", () => {
    expect(normalizeTimestamp(null)).toBeUndefined();
    expect(normalizeTimestamp(undefined)).toBeUndefined();
    expect(normalizeTimestamp("not a date")).toBeUndefined();
  });
});

describe("isoDatePart", () => {
  it("extracts the date portion", () => {
    expect(isoDatePart("2026-08-31T12:00:00.000Z")).toBe("2026-08-31");
  });

  it("returns undefined for undefined input", () => {
    expect(isoDatePart(undefined)).toBeUndefined();
  });
});
