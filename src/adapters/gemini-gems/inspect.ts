import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectGeminiGems } from "./detect.js";
import { findGeminiGemsFile, findScheduledActionsFile, isEmptyTakeoutFragment } from "./parse-source.js";

export async function inspectGeminiGems(input: InputSource): Promise<InspectionResult> {
  const detection = await detectGeminiGems(input);
  const found = await findGeminiGemsFile(input);

  if (!found) {
    return {
      source: "gemini-gems",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no gemini_gems_data.html file with a valid structure was found"],
    };
  }

  const potentialIssues: string[] = [];
  const withFiles = found.gems.filter((g) => g.files.length > 0).length;
  const withoutName = found.gems.filter((g) => !g.name).length;

  if (withFiles > 0) {
    potentialIssues.push(`${withFiles} Gem(s) reference files that will not be copied`);
  }
  if (withoutName > 0) {
    potentialIssues.push(`${withoutName} Gem(s) have no name`);
  }

  const scheduledActionsPath = await findScheduledActionsFile(input);
  if (scheduledActionsPath && !isEmptyTakeoutFragment(await input.readText(scheduledActionsPath))) {
    potentialIssues.push("scheduled actions data is present but not supported by this adapter");
  }

  return {
    source: "gemini-gems",
    confidence: detection.confidence,
    contents: [{ label: "Gems", count: found.gems.length }],
    potentialIssues,
  };
}
