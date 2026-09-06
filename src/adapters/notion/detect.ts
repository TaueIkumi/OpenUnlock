import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { isNotionExportFile } from "./parse-source.js";

export async function detectNotion(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const evidence: string[] = [];

  if (files.length === 0) {
    return { adapter: "notion", confidence: 0, evidence: ["archive is empty"] };
  }

  const relevantFiles = files.filter((f) => f.endsWith(".md") || f.endsWith(".csv"));
  const matches = relevantFiles.filter((f) => isNotionExportFile(f) !== null);

  if (relevantFiles.length === 0) {
    return { adapter: "notion", confidence: 0, evidence: ["no .md or .csv files found"] };
  }

  const ratio = matches.length / relevantFiles.length;

  if (matches.length === 0) {
    return {
      adapter: "notion",
      confidence: 0,
      evidence: [".md/.csv files found, but none match the Notion `<Title> <32-hex-id>` naming pattern"],
    };
  }

  evidence.push(
    `${matches.length}/${relevantFiles.length} .md/.csv files match the Notion export naming pattern`,
  );

  // High ratio + at least a couple of matches is strong structural evidence.
  const confidence = Math.min(0.5 + ratio * 0.45 + Math.min(matches.length, 5) * 0.01, 0.98);

  return { adapter: "notion", confidence, evidence };
}
