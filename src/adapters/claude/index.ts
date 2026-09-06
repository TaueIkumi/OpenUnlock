import type { SourceAdapter } from "../../core/adapter.js";
import { detectClaude } from "./detect.js";
import { inspectClaude } from "./inspect.js";
import { parseClaude } from "./parse.js";

export const claudeAdapter: SourceAdapter = {
  id: "claude",
  displayName: "Claude",
  detect: detectClaude,
  inspect: inspectClaude,
  parse: parseClaude,
};
