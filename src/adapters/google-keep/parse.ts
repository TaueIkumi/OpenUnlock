import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findGoogleKeepNotes } from "./parse-source.js";
import { normalizeNote } from "./normalize.js";

export async function* parseGoogleKeep(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const notes = await findGoogleKeepNotes(input);
  if (notes.length === 0) {
    throw new MalformedExportError(
      "No .json file matching the expected Google Keep Takeout note structure was found.",
    );
  }

  for (const { path: notePath, note } of notes.sort((a, b) => a.path.localeCompare(b.path))) {
    const normalized = await normalizeNote(
      notePath,
      note,
      input,
      context.diagnostics,
      context.attachmentBlobs,
    );
    yield normalized.document;
    for (const attachment of normalized.attachments) {
      yield attachment;
    }
  }
}
