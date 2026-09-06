import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findLinearFile } from "./parse-source.js";

export async function detectLinear(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));

  if (csvFiles.length === 0) {
    return { adapter: "linear", confidence: 0, evidence: ["no .csv file found"] };
  }

  const found = await findLinearFile(input);
  if (!found) {
    return {
      adapter: "linear",
      confidence: 0,
      evidence: [
        "no CSV file matched the expected Linear export structure " +
          '(an "ID"/"Title" column, a Linear-specific column, and issue-key-shaped ids like "ENG-42")',
      ],
    };
  }

  return {
    adapter: "linear",
    confidence: 0.9,
    evidence: [
      `found issue export: ${found.path}`,
      `${found.table.rows.length} row(s) with issue-key-shaped ids`,
    ],
  };
}
