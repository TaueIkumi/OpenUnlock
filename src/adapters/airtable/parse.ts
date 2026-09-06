import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findAirtableTables } from "./parse-source.js";
import { normalizeTable } from "./normalize.js";

export async function* parseAirtable(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const tables = await findAirtableTables(input);
  if (tables.length === 0) {
    throw new MalformedExportError("No CSV file with a header row was found.");
  }

  for (const { path, table } of tables.sort((a, b) => a.path.localeCompare(b.path))) {
    const normalized = normalizeTable(path, table, context.diagnostics);
    yield normalized.collection;
    for (const document of normalized.documents) {
      yield document;
    }
  }
}
