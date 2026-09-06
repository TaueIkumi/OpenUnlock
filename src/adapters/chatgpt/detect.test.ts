import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectChatGpt } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectChatGpt", () => {
  it("detects a well-formed ChatGPT export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectChatGpt(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns zero confidence when conversations.json is missing", async () => {
    const input = await openInputSource(fixturesDir); // fixtures/ has no conversations.json directly
    const result = await detectChatGpt(input);
    expect(result.confidence).toBe(0);
  });

  it("lowers confidence for malformed JSON", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectChatGpt(input);
    expect(result.confidence).toBeLessThan(0.9);
  });
});
