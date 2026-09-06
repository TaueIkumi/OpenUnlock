import { describe, expect, it } from "vitest";
import { slugify, sanitizeFilenameSegment, buildDeterministicFilename } from "./filenames.js";

describe("slugify", () => {
  it("lowercases and dashes titles", () => {
    expect(slugify("Weekend Trip Ideas!")).toBe("weekend-trip-ideas");
  });

  it("falls back to untitled for empty input", () => {
    expect(slugify(undefined)).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
  });
});

describe("sanitizeFilenameSegment", () => {
  it("prefixes Windows-reserved names", () => {
    expect(sanitizeFilenameSegment("CON.md")).toMatch(/^_/);
    expect(sanitizeFilenameSegment("con")).toMatch(/^_/);
  });

  it("leaves normal names untouched", () => {
    expect(sanitizeFilenameSegment("2026-01-01-hello--abc123.md")).toBe(
      "2026-01-01-hello--abc123.md",
    );
  });
});

describe("buildDeterministicFilename", () => {
  it("produces the same filename for the same input", () => {
    const options = { date: "2026-08-31", title: "Project Idea", shortId: "a1b2c3", extension: "md" };
    expect(buildDeterministicFilename(options)).toBe(buildDeterministicFilename(options));
    expect(buildDeterministicFilename(options)).toBe("2026-08-31-project-idea--a1b2c3.md");
  });

  it("uses 'untitled' when no title is given", () => {
    expect(
      buildDeterministicFilename({ shortId: "abc123", extension: "md" }),
    ).toBe("undated-untitled--abc123.md");
  });
});
