import type { SourceAdapter } from "../../core/adapter.js";
import { detectGoogleKeep } from "./detect.js";
import { inspectGoogleKeep } from "./inspect.js";
import { parseGoogleKeep } from "./parse.js";

export const googleKeepAdapter: SourceAdapter = {
  id: "google-keep",
  displayName: "Google Keep",
  detect: detectGoogleKeep,
  inspect: inspectGoogleKeep,
  parse: parseGoogleKeep,
};
