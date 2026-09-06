import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { findGoogleTaskLists } from "./parse-source.js";

export async function detectGoogleTasks(input: InputSource): Promise<DetectionResult> {
  const files = await input.listFiles();
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  if (jsonFiles.length === 0) {
    return { adapter: "google-tasks", confidence: 0, evidence: ["no .json file found"] };
  }

  const lists = await findGoogleTaskLists(input);
  if (lists.length === 0) {
    return {
      adapter: "google-tasks",
      confidence: 0,
      evidence: [
        'no JSON file matched the expected Google Tasks Takeout structure ("kind": "tasks#taskList")',
      ],
    };
  }

  const taskCount = lists.reduce((sum, l) => sum + (l.list.items?.length ?? 0), 0);
  return {
    adapter: "google-tasks",
    confidence: 0.95,
    evidence: [`found ${lists.length} task list(s) with ${taskCount} task(s), matching "tasks#taskList"`],
  };
}
