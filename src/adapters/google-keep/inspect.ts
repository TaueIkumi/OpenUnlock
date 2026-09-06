import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectGoogleKeep } from "./detect.js";
import { findGoogleKeepNotes } from "./parse-source.js";

export async function inspectGoogleKeep(input: InputSource): Promise<InspectionResult> {
  const detection = await detectGoogleKeep(input);
  const notes = await findGoogleKeepNotes(input);

  if (notes.length === 0) {
    return {
      source: "google-keep",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no .json file matching the expected Google Keep Takeout note structure was found"],
    };
  }

  const attachmentCount = notes.reduce((sum, n) => sum + (n.note.attachments?.length ?? 0), 0);
  const trashedCount = notes.filter((n) => n.note.isTrashed).length;
  const potentialIssues: string[] = [];
  if (trashedCount > 0) {
    potentialIssues.push(`${trashedCount} note(s) are in trash but will still be converted`);
  }

  return {
    source: "google-keep",
    confidence: detection.confidence,
    contents: [
      { label: "Notes", count: notes.length },
      { label: "Attachments", count: attachmentCount },
    ],
    potentialIssues,
  };
}
