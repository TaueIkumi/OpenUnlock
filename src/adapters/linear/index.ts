import type { SourceAdapter } from "../../core/adapter.js";
import { detectLinear } from "./detect.js";
import { inspectLinear } from "./inspect.js";
import { parseLinear } from "./parse.js";

export const linearAdapter: SourceAdapter = {
  id: "linear",
  displayName: "Linear",
  detect: detectLinear,
  inspect: inspectLinear,
  parse: parseLinear,
};
