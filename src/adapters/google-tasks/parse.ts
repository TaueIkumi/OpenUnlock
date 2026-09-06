import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findGoogleTaskLists } from "./parse-source.js";
import { normalizeTaskList } from "./normalize.js";

export async function* parseGoogleTasks(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const lists = await findGoogleTaskLists(input);
  if (lists.length === 0) {
    throw new MalformedExportError(
      'No .json file matching the expected Google Tasks Takeout structure ("kind": "tasks#taskList") was found.',
    );
  }

  for (const { path: listPath, list } of lists.sort((a, b) => a.path.localeCompare(b.path))) {
    const normalized = normalizeTaskList(listPath, list, context.diagnostics);
    yield normalized.collection;
    for (const document of normalized.documents) {
      yield document;
    }
    for (const relation of normalized.relations) {
      yield relation;
    }
  }
}
