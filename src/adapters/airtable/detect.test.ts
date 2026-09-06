import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectAirtable } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectAirtable", () => {
  it("is confident when Airtable CDN attachment URLs are present", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectAirtable(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("is deliberately low-confidence for a generic CSV with no Airtable-specific evidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "edge-cases"));
    const result = await detectAirtable(input);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("returns zero confidence when no CSV with a header row is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectAirtable(input);
    expect(result.confidence).toBe(0);
  });
});
