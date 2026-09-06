import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectEvernote } from "./detect.js";
import { findEvernoteFile } from "./parse-source.js";

export async function inspectEvernote(input: InputSource): Promise<InspectionResult> {
  const detection = await detectEvernote(input);

  const found = await findEvernoteFile(input);
  if (!found) {
    return {
      source: "evernote",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no .enex file with a valid <en-export> root element was found"],
    };
  }

  const potentialIssues: string[] = [];
  const notes = found.parsed.notes;
  const resourceCount = notes.reduce((sum, n) => sum + n.resources.length, 0);
  const notesWithoutData = notes.reduce(
    (sum, n) => sum + n.resources.filter((r) => !r.data).length,
    0,
  );
  const notesMissingCreated = notes.filter((n) => !n.created).length;

  if (notesWithoutData > 0) {
    potentialIssues.push(`${notesWithoutData} resource(s) have no embedded data`);
  }
  if (notesMissingCreated > 0) {
    potentialIssues.push(`${notesMissingCreated} note(s) missing a <created> timestamp`);
  }

  return {
    source: "evernote",
    confidence: detection.confidence,
    contents: [
      { label: "Notes", count: notes.length },
      { label: "Resources (attachments)", count: resourceCount },
    ],
    potentialIssues,
  };
}
