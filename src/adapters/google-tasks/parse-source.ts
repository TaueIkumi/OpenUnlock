import type { InputSource } from "../../core/input.js";

/**
 * Raw shape of a Google Takeout "Tasks" export — one `.json` file per task
 * list, named after the list's title (arbitrary, so detection is
 * structural, not filename-based). This mirrors the shape of the Google
 * Tasks API itself (`kind: "tasks#taskList"` / `"tasks#task"`), which is
 * what Takeout actually dumps.
 *
 * This is a single Takeout *module* alongside Google Keep — see AGENT.md
 * section 32 for why a whole-Takeout adapter isn't the right shape.
 *
 * Fields are optional and loosely typed on purpose — see AGENT.md section
 * 21, Forward Compatibility.
 */

export interface GoogleTask {
  kind?: string;
  id?: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  completed?: string;
  updated?: string;
  parent?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

export interface GoogleTaskList {
  kind?: string;
  id?: string;
  title?: string;
  updated?: string;
  items?: GoogleTask[];
  [key: string]: unknown;
}

/**
 * Structural check: the exact `kind` discriminators Google's own Tasks
 * API (and Takeout's dump of it) uses — not something a coincidental,
 * unrelated JSON file would carry.
 */
export function isPlausibleGoogleTaskList(data: unknown): data is GoogleTaskList {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj.kind !== "tasks#taskList") {
    return false;
  }
  if (obj.items === undefined) {
    return true;
  }
  if (!Array.isArray(obj.items)) {
    return false;
  }
  return obj.items.every(
    (item) => typeof item === "object" && item !== null && (item as Record<string, unknown>).kind === "tasks#task",
  );
}

export async function findGoogleTaskLists(
  input: InputSource,
): Promise<{ path: string; list: GoogleTaskList }[]> {
  const files = await input.listFiles();
  const results: { path: string; list: GoogleTaskList }[] = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".json")) continue;
    let data: unknown;
    try {
      data = JSON.parse(await input.readText(file));
    } catch {
      continue;
    }
    if (isPlausibleGoogleTaskList(data)) {
      results.push({ path: file, list: data });
    }
  }

  return results;
}
