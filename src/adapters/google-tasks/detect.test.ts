import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectGoogleTasks } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectGoogleTasks", () => {
  it("detects a well-formed Google Tasks Takeout export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectGoogleTasks(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns zero confidence for a JSON file that isn't a Tasks list", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectGoogleTasks(input);
    expect(result.confidence).toBe(0);
  });
});
