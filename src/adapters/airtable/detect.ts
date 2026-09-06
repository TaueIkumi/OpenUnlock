import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findAirtableTables } from "./parse-source.js";

/** Below this, detectSource() treats the result as ambiguous and asks for --from. */
const GENERIC_CSV_CONFIDENCE = 0.3;
const CDN_EVIDENCE_CONFIDENCE = 0.8;

export async function detectAirtable(input: InputSource): Promise<DetectionResult> {
  const tables = await findAirtableTables(input);

  if (tables.length === 0) {
    return { adapter: "airtable", confidence: 0, evidence: ["no CSV file with a header row was found"] };
  }

  const withCdnEvidence = tables.filter((t) => t.hasCdnEvidence);
  if (withCdnEvidence.length > 0) {
    return {
      adapter: "airtable",
      confidence: CDN_EVIDENCE_CONFIDENCE,
      evidence: [
        `found ${tables.length} table export(s)`,
        `${withCdnEvidence.length} contain Airtable CDN attachment URLs (dl.airtable.com / *.airtableusercontent.com)`,
      ],
    };
  }

  return {
    adapter: "airtable",
    confidence: GENERIC_CSV_CONFIDENCE,
    evidence: [
      `found ${tables.length} generic CSV table(s) with a header row`,
      "no Airtable-specific evidence (e.g. attachment CDN URLs) found — " +
        "a plain CSV export is inherently ambiguous; specify --from airtable if this is one",
    ],
  };
}
