import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectLinear } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectLinear", () => {
  it("detects a well-formed Linear issue export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectLinear(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns zero confidence for a CSV that isn't a Linear export", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectLinear(input);
    expect(result.confidence).toBe(0);
  });

  it("still detects an export with a handful of blank ids", async () => {
    const input = await openInputSource(path.join(fixturesDir, "edge-cases"));
    const result = await detectLinear(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
