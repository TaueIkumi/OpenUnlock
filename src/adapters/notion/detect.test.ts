import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectNotion } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectNotion", () => {
  it("detects a Notion Markdown & CSV export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectNotion(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects nested page exports", async () => {
    const input = await openInputSource(path.join(fixturesDir, "nested-pages"));
    const result = await detectNotion(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns zero confidence for non-Notion files", async () => {
    const input = await openInputSource(path.join(fixturesDir, "attachments", "Photo Album 66666666666666666666666666666666"));
    const result = await detectNotion(input);
    expect(result.confidence).toBe(0);
  });
});
