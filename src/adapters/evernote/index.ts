import type { SourceAdapter } from "../../core/adapter.js";
import { detectEvernote } from "./detect.js";
import { inspectEvernote } from "./inspect.js";
import { parseEvernote } from "./parse.js";

export const evernoteAdapter: SourceAdapter = {
  id: "evernote",
  displayName: "Evernote",
  detect: detectEvernote,
  inspect: inspectEvernote,
  parse: parseEvernote,
};
