import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectGoogleTasks } from "./detect.js";
import { findGoogleTaskLists } from "./parse-source.js";

export async function inspectGoogleTasks(input: InputSource): Promise<InspectionResult> {
  const detection = await detectGoogleTasks(input);
  const lists = await findGoogleTaskLists(input);

  if (lists.length === 0) {
    return {
      source: "google-tasks",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ['no .json file matching the expected Google Tasks Takeout structure was found'],
    };
  }

  const tasks = lists.flatMap((l) => l.list.items ?? []);
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const subtaskCount = tasks.filter((t) => t.parent).length;
  const missingTitleCount = tasks.filter((t) => !t.title).length;

  const potentialIssues: string[] = [];
  if (missingTitleCount > 0) {
    potentialIssues.push(`${missingTitleCount} task(s) have no title`);
  }

  return {
    source: "google-tasks",
    confidence: detection.confidence,
    contents: [
      { label: "Task lists", count: lists.length },
      { label: "Tasks", count: tasks.length },
      { label: "Completed", count: completedCount },
      { label: "Sub-tasks", count: subtaskCount },
    ],
    potentialIssues,
  };
}
