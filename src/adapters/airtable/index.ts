import type { SourceAdapter } from "../../core/adapter.js";
import { detectAirtable } from "./detect.js";
import { inspectAirtable } from "./inspect.js";
import { parseAirtable } from "./parse.js";

export const airtableAdapter: SourceAdapter = {
  id: "airtable",
  displayName: "Airtable",
  detect: detectAirtable,
  inspect: inspectAirtable,
  parse: parseAirtable,
};
