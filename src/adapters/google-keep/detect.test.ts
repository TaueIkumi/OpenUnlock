import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectGoogleKeep } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectGoogleKeep", () => {
  it("detects a well-formed Google Keep Takeout export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectGoogleKeep(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("returns zero confidence for a JSON file that isn't a Keep note", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectGoogleKeep(input);
    expect(result.confidence).toBe(0);
  });
});
