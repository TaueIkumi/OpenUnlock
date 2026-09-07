import type { SourceAdapter } from "../../core/adapter.js";
import { detectGeminiGems } from "./detect.js";
import { inspectGeminiGems } from "./inspect.js";
import { parseGeminiGems } from "./parse.js";

export const geminiGemsAdapter: SourceAdapter = {
  id: "gemini-gems",
  displayName: "Gemini Gems",
  detect: detectGeminiGems,
  inspect: inspectGeminiGems,
  parse: parseGeminiGems,
};
