import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectNotion } from "./detect.js";
import { isNotionExportFile } from "./parse-source.js";

export async function inspectNotion(input: InputSource): Promise<InspectionResult> {
  const detection = await detectNotion(input);
  const files = await input.listFiles();

  let pageCount = 0;
  let databaseCount = 0;
  let attachmentCount = 0;

  for (const file of files) {
    const parsed = isNotionExportFile(file);
    if (parsed?.ext === "md") {
      pageCount++;
    } else if (parsed?.ext === "csv") {
      databaseCount++;
    } else {
      attachmentCount++;
    }
  }

  const potentialIssues: string[] = [];
  if (attachmentCount > 0) {
    potentialIssues.push(
      `${attachmentCount} non-page files present (likely attachments; not yet copied on conversion)`,
    );
  }

  return {
    source: "notion",
    confidence: detection.confidence,
    contents: [
      { label: "Pages", count: pageCount },
      { label: "Databases", count: databaseCount },
    ],
    potentialIssues,
  };
}
