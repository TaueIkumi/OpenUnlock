import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectSlack } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectSlack", () => {
  it("detects a well-formed Slack export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectSlack(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns zero confidence when channels.json and users.json are both missing", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic", "general"));
    const result = await detectSlack(input);
    expect(result.confidence).toBe(0);
  });
});
