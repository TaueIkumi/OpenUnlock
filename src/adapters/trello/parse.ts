import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findBoardFile, isPlausibleTrelloBoard } from "./parse-source.js";
import { normalizeBoard } from "./normalize.js";

export async function* parseTrello(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const boardFile = await findBoardFile(input);
  if (!boardFile) {
    throw new MalformedExportError(
      "No file matching the expected Trello board export structure " +
        '(object with "id", "name", "lists", and "cards") was found. ' +
        "This export may be newer or older than the installed Trello adapter supports.",
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(await input.readText(boardFile));
  } catch {
    throw new MalformedExportError(`Failed to parse ${boardFile}: not valid JSON.`);
  }

  if (!isPlausibleTrelloBoard(data)) {
    throw new MalformedExportError(
      `${boardFile} does not match the expected Trello board export structure.`,
    );
  }

  const normalized = normalizeBoard(data, context.diagnostics);

  yield normalized.workspace;
  for (const person of normalized.people) yield person;
  for (const collection of normalized.collections) yield collection;
  for (const document of normalized.documents) yield document;
  for (const message of normalized.messages) yield message;
  for (const relation of normalized.relations) yield relation;
}
