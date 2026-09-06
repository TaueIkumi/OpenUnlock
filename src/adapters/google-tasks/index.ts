import type { SourceAdapter } from "../../core/adapter.js";
import { detectGoogleTasks } from "./detect.js";
import { inspectGoogleTasks } from "./inspect.js";
import { parseGoogleTasks } from "./parse.js";

export const googleTasksAdapter: SourceAdapter = {
  id: "google-tasks",
  displayName: "Google Tasks",
  detect: detectGoogleTasks,
  inspect: inspectGoogleTasks,
  parse: parseGoogleTasks,
};
