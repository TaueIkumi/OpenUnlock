import type { SourceAdapter } from "../../core/adapter.js";
import { detectNotion } from "./detect.js";
import { inspectNotion } from "./inspect.js";
import { parseNotion } from "./parse.js";

export const notionAdapter: SourceAdapter = {
  id: "notion",
  displayName: "Notion",
  detect: detectNotion,
  inspect: inspectNotion,
  parse: parseNotion,
};
