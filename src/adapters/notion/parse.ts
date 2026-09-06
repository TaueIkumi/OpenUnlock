import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { isNotionExportFile } from "./parse-source.js";
import { buildPageIndex, normalizeDatabase, normalizePage } from "./normalize.js";

export async function* parseNotion(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const files = await input.listFiles();
  const allFiles = new Set(files);
  const index = buildPageIndex(files);

  const seenAttachments = new Set<string>();

  for (const file of files) {
    const parsed = isNotionExportFile(file);
    if (!parsed) continue;

    if (parsed.ext === "md") {
      const rawContent = await input.readText(file);
      const { document, attachments } = normalizePage(
        rawContent,
        file,
        index,
        allFiles,
        context.diagnostics,
      );
      for (const attachment of attachments) {
        if (!seenAttachments.has(attachment.id)) {
          seenAttachments.add(attachment.id);
          yield attachment;
        }
      }
      yield document;
    } else {
      const csvText = await input.readText(file);
      const { collection, rows } = normalizeDatabase(csvText, file, index, context.diagnostics);
      yield collection;
      for (const row of rows) {
        yield row;
      }
    }
  }
}
