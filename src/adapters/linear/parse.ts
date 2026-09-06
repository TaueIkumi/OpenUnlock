import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findLinearFile } from "./parse-source.js";
import { normalizeExport } from "./normalize.js";

export async function* parseLinear(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const found = await findLinearFile(input);
  if (!found) {
    throw new MalformedExportError(
      "No CSV file matching the expected Linear export structure was found. " +
        "This export may be newer or older than the installed Linear adapter supports.",
    );
  }

  const normalized = normalizeExport(found.table, context.diagnostics);

  for (const person of normalized.people) yield person;
  for (const collection of normalized.collections) yield collection;
  for (const document of normalized.documents) yield document;
  for (const relation of normalized.relations) yield relation;
}
