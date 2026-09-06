import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectAirtable } from "./detect.js";
import { AIRTABLE_CDN_PATTERN, findAirtableTables } from "./parse-source.js";

export async function inspectAirtable(input: InputSource): Promise<InspectionResult> {
  const detection = await detectAirtable(input);
  const tables = await findAirtableTables(input);

  if (tables.length === 0) {
    return {
      source: "airtable",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no CSV file with a header row was found"],
    };
  }

  const totalRows = tables.reduce((sum, t) => sum + t.table.rows.length, 0);
  const attachmentCells = tables.reduce(
    (sum, t) =>
      sum +
      t.table.rows.reduce(
        (rowSum, row) =>
          rowSum + Object.values(row).filter((v) => AIRTABLE_CDN_PATTERN.test(v)).length,
        0,
      ),
    0,
  );

  const potentialIssues: string[] = [];
  if (attachmentCells > 0) {
    potentialIssues.push(`${attachmentCells} field value(s) reference attachments that will not be copied`);
  }
  if (detection.confidence < 0.6) {
    potentialIssues.push(
      "low detection confidence — this looks like a generic CSV; specify --from airtable to convert it anyway",
    );
  }

  return {
    source: "airtable",
    confidence: detection.confidence,
    contents: [
      { label: "Tables", count: tables.length },
      { label: "Rows", count: totalRows },
    ],
    potentialIssues,
  };
}
