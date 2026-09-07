import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectGeminiGems } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectGeminiGems", () => {
  it("detects a well-formed Gemini Gems export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectGeminiGems(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("returns zero confidence for a same-named file with unrelated content", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectGeminiGems(input);
    expect(result.confidence).toBe(0);
  });
});
