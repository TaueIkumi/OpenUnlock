import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Collection, Document } from "../../core/canonical/types.js";
import type { CsvTable } from "../../utils/csv.js";
import { shortId } from "../../utils/hashing.js";
import { AIRTABLE_CDN_PATTERN, tableTitleFromFilename } from "./parse-source.js";

export interface NormalizedTable {
  collection: Collection;
  documents: Document[];
}

export function normalizeTable(
  relativePath: string,
  table: CsvTable,
  diagnostics: DiagnosticCollector,
): NormalizedTable {
  const title = tableTitleFromFilename(relativePath);
  const collectionId = `airtable:collection:${shortId("airtable", relativePath)}`;

  const collection: Collection = {
    id: collectionId,
    type: "collection",
    title,
    source: { service: "airtable", sourcePath: relativePath },
  };

  if (table.headers.length === 0) {
    diagnostics.warning(`Table has no columns`, collectionId);
    return { collection, documents: [] };
  }

  // Airtable's export always puts the primary field first.
  const primaryField = table.headers[0]!;

  const documents: Document[] = table.rows.map((row, rowIndex) => {
    const documentId = `${collectionId}:row-${rowIndex}`;
    const rowTitle = row[primaryField]?.trim();

    const bodyLines: string[] = [];
    for (const header of table.headers) {
      if (header === primaryField) continue;
      const value = row[header] ?? "";
      if (AIRTABLE_CDN_PATTERN.test(value)) {
        diagnostics.lossyConversion(
          `Field "${header}" contains an attachment reference; Airtable's CSV export only provides ` +
            `a CDN URL (which expires and requires the base's own access), not the file bytes`,
          documentId,
        );
      }
      bodyLines.push(`- **${header}**: ${value}`);
    }

    return {
      id: documentId,
      type: "document",
      title: rowTitle && rowTitle.length > 0 ? rowTitle : undefined,
      format: "markdown",
      content: bodyLines.join("\n"),
      parentId: collectionId,
      source: {
        service: "airtable",
        sourceId: `row-${rowIndex}`,
        sourcePath: relativePath,
      },
      metadata: { airtable: { table: title, row: rowIndex } },
    };
  });

  return { collection, documents };
}
