import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findEvernoteFile } from "./parse-source.js";
import { normalizeExport } from "./normalize.js";

export async function* parseEvernote(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const found = await findEvernoteFile(input);
  if (!found) {
    throw new MalformedExportError(
      "No .enex file with a valid <en-export> root element was found. " +
        "This export may be newer or older than the installed Evernote adapter supports.",
    );
  }

  const normalized = normalizeExport(
    found.path,
    found.parsed,
    context.diagnostics,
    context.attachmentBlobs,
  );

  yield normalized.collection;
  for (const person of normalized.people) yield person;
  for (const document of normalized.documents) yield document;
  for (const attachment of normalized.attachments) yield attachment;
}
