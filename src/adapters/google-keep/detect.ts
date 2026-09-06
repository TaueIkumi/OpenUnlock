import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findGoogleKeepNotes } from "./parse-source.js";

export async function detectGoogleKeep(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  if (jsonFiles.length === 0) {
    return { adapter: "google-keep", confidence: 0, evidence: ["no .json file found"] };
  }

  const notes = await findGoogleKeepNotes(input);
  if (notes.length === 0) {
    return {
      adapter: "google-keep",
      confidence: 0,
      evidence: [
        "no JSON file matched the expected Google Keep Takeout note structure " +
          '("isTrashed"/"isPinned"/"isArchived" flags plus a timestamp)',
      ],
    };
  }

  return {
    adapter: "google-keep",
    confidence: Math.min(0.85 + Math.min(notes.length, 5) * 0.02, 0.95),
    evidence: [`found ${notes.length} note(s) matching the Google Keep Takeout structure`],
  };
}
