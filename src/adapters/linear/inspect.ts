import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectLinear } from "./detect.js";
import { findColumn, findLinearFile } from "./parse-source.js";

export async function inspectLinear(input: InputSource): Promise<InspectionResult> {
  const detection = await detectLinear(input);

  const found = await findLinearFile(input);
  if (!found) {
    return {
      source: "linear",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no CSV file matching the expected Linear export structure was found"],
    };
  }

  const potentialIssues: string[] = [];
  const teams = new Set(found.table.rows.map((r) => findColumn(r, "team")).filter(Boolean));
  const withoutId = found.table.rows.filter((r) => !findColumn(r, "id")).length;
  const withParent = found.table.rows.filter((r) => findColumn(r, "parent")).length;

  if (withoutId > 0) {
    potentialIssues.push(`${withoutId} row(s) missing an id and will be skipped`);
  }

  return {
    source: "linear",
    confidence: detection.confidence,
    contents: [
      { label: "Issues", count: found.table.rows.length },
      { label: "Teams", count: teams.size },
      { label: "Sub-issue relations", count: withParent },
    ],
    potentialIssues,
  };
}
