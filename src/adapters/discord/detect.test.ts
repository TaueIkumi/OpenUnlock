import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectDiscord } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectDiscord", () => {
  it("detects a well-formed Discord export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectDiscord(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns zero confidence when messages/index.json is missing or invalid", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectDiscord(input);
    expect(result.confidence).toBe(0);
  });
});
