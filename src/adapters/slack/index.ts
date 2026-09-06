import type { SourceAdapter } from "../../core/adapter.js";
import { detectSlack } from "./detect.js";
import { inspectSlack } from "./inspect.js";
import { parseSlack } from "./parse.js";

export const slackAdapter: SourceAdapter = {
  id: "slack",
  displayName: "Slack",
  detect: detectSlack,
  inspect: inspectSlack,
  parse: parseSlack,
};
