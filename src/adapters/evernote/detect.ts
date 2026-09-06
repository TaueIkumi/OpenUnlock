import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findEvernoteFile } from "./parse-source.js";

export async function detectEvernote(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const enexFiles = files.filter((f) => f.toLowerCase().endsWith(".enex"));

  if (enexFiles.length === 0) {
    return { adapter: "evernote", confidence: 0, evidence: ["no .enex file found"] };
  }

  const found = await findEvernoteFile(input);
  if (!found) {
    return {
      adapter: "evernote",
      confidence: 0,
      evidence: [".enex file found, but did not parse as a valid <en-export> document"],
    };
  }

  const evidence = [`found Evernote export: ${found.path}`, "root element is <en-export>"];
  let confidence = 0.85;

  if (found.parsed.notes.length > 0) {
    evidence.push(`contains ${found.parsed.notes.length} note(s)`);
    confidence += 0.1;
  }

  return { adapter: "evernote", confidence: Math.min(confidence, 1), evidence };
}
