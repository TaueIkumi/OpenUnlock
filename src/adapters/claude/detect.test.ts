import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectClaude } from "./detect.js";
import { detectChatGpt } from "../chatgpt/detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const chatgptFixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../chatgpt/fixtures",
);

describe("detectClaude", () => {
  it("detects a well-formed Claude.ai export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectClaude(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns zero confidence when conversations.json is missing", async () => {
    const input = await openInputSource(fixturesDir);
    const result = await detectClaude(input);
    expect(result.confidence).toBe(0);
  });

  it("lowers confidence for malformed JSON", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectClaude(input);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it("does not mistake a ChatGPT export for a Claude export (same filename, different schema)", async () => {
    const input = await openInputSource(path.join(chatgptFixturesDir, "basic"));
    const claudeResult = await detectClaude(input);
    const chatgptResult = await detectChatGpt(input);
    // Both see conversations.json, so a shallow "file exists" signal alone
    // is ambiguous; what must hold is core/detection.ts's actual
    // disambiguation rule — the winner must clear the runner-up by more
    // than MIN_CONFIDENT_DETECTION's margin (0.05) so ChatGPT wins outright.
    expect(chatgptResult.confidence - claudeResult.confidence).toBeGreaterThan(0.05);
  });
});
