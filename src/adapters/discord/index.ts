import type { SourceAdapter } from "../../core/adapter.js";
import { detectDiscord } from "./detect.js";
import { inspectDiscord } from "./inspect.js";
import { parseDiscord } from "./parse.js";

export const discordAdapter: SourceAdapter = {
  id: "discord",
  displayName: "Discord",
  detect: detectDiscord,
  inspect: inspectDiscord,
  parse: parseDiscord,
};
