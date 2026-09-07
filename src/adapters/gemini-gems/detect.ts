import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findGeminiGemsFile } from "./parse-source.js";

export async function detectGeminiGems(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const candidates = files.filter((f) => f.toLowerCase().endsWith("gemini_gems_data.html"));

  if (candidates.length === 0) {
    return { adapter: "gemini-gems", confidence: 0, evidence: ["no gemini_gems_data.html file found"] };
  }

  const found = await findGeminiGemsFile(input);
  if (!found) {
    return {
      adapter: "gemini-gems",
      confidence: 0,
      evidence: [
        "found a file named gemini_gems_data.html, but its content did not structurally " +
          "parse as a Gemini Gems export",
      ],
    };
  }

  return {
    adapter: "gemini-gems",
    confidence: 0.9,
    evidence: [
      `found ${found.path}`,
      found.gems.length > 0
        ? `parsed ${found.gems.length} Gem(s) from its structure`
        : "file is present and structurally empty (no Gems saved)",
    ],
  };
}
