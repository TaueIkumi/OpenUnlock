import type { SourceAdapter } from "../../core/adapter.js";
import { detectTrello } from "./detect.js";
import { inspectTrello } from "./inspect.js";
import { parseTrello } from "./parse.js";

export const trelloAdapter: SourceAdapter = {
  id: "trello",
  displayName: "Trello",
  detect: detectTrello,
  inspect: inspectTrello,
  parse: parseTrello,
};
