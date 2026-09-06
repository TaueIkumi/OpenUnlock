import path from "node:path";
import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Attachment, Collection, Document } from "../../core/canonical/types.js";
import { shortId } from "../../utils/hashing.js";
import { parseCsvTable } from "../../utils/csv.js";
import { extractNotionId, isNotionExportFile, parentMdPathFor } from "./parse-source.js";

export interface PageIndexEntry {
  canonicalId: string;
  title: string;
  relativePath: string;
  notionId: string;
}

/** First pass: index every page/database file by its Notion id, before any content is parsed. */
export function buildPageIndex(files: string[]): Map<string, PageIndexEntry> {
  const index = new Map<string, PageIndexEntry>();
  for (const file of files) {
    const parsedFile = isNotionExportFile(file);
    if (!parsedFile) continue;
    const kind = parsedFile.ext === "md" ? "document" : "collection";
    index.set(parsedFile.parsed.notionId, {
      canonicalId: `notion:${kind}:${parsedFile.parsed.notionId}`,
      title: parsedFile.parsed.title,
      relativePath: file,
      notionId: parsedFile.parsed.notionId,
    });
  }
  return index;
}

function resolveParentId(
  relativePath: string,
  index: Map<string, PageIndexEntry>,
): string | undefined {
  const parentMdPath = parentMdPathFor(relativePath);
  if (!parentMdPath) return undefined;
  for (const entry of index.values()) {
    if (entry.relativePath === parentMdPath) {
      return entry.canonicalId;
    }
  }
  return undefined;
}

const LINK_PATTERN = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;

interface LinkRewriteResult {
  content: string;
  relatedDocumentIds: string[];
  attachments: Attachment[];
}

/**
 * Rewrite links to other pages in this export into the generic
 * `openunlock://entity/<id>` scheme, which any exporter can resolve without
 * knowing about Notion specifically. Links to files that aren't other
 * Notion pages (images, PDFs, etc.) become Attachment references; links
 * that can't be resolved at all are reported, not silently dropped.
 */
function rewriteLinks(
  content: string,
  relativePath: string,
  index: Map<string, PageIndexEntry>,
  allFiles: Set<string>,
  diagnostics: DiagnosticCollector,
  ref: string,
): LinkRewriteResult {
  const relatedDocumentIds = new Set<string>();
  const attachments: Attachment[] = [];
  const seenAttachmentPaths = new Set<string>();

  const rewritten = content.replace(LINK_PATTERN, (full, bang: string, label: string, href: string) => {
    if (/^[a-z]+:\/\//i.test(href) || href.startsWith("mailto:")) {
      return full; // external link, leave untouched
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      decoded = href;
    }

    const notionId = extractNotionId(decoded);
    if (notionId) {
      const target = index.get(notionId);
      if (target) {
        relatedDocumentIds.add(target.canonicalId);
        return `${bang}[${label}](openunlock://entity/${target.canonicalId})`;
      }
      diagnostics.missingReference(
        `Link to Notion page (id ${notionId}) not found in this export`,
        ref,
      );
      return full;
    }

    // Not a page link — check whether it resolves to another file in the
    // export (an attachment such as an image or PDF).
    const resolvedPath = path.posix.normalize(
      path.posix.join(path.posix.dirname(relativePath), decoded),
    );
    if (allFiles.has(resolvedPath)) {
      const attachmentId = `notion:attachment:${shortId("notion", resolvedPath)}`;
      if (!seenAttachmentPaths.has(resolvedPath)) {
        seenAttachmentPaths.add(resolvedPath);
        attachments.push({
          id: attachmentId,
          type: "attachment",
          filename: path.posix.basename(resolvedPath),
          localPath: resolvedPath,
          source: { service: "notion", sourcePath: resolvedPath },
        });
        diagnostics.lossyConversion(
          `Attachment "${path.posix.basename(resolvedPath)}" is referenced but not copied to output`,
          ref,
        );
      }
      return full; // leave the original relative link; exporters don't have the bytes to relink to.
    }

    diagnostics.missingReference(`Link target not found in export: ${href}`, ref);
    return full;
  });

  return { content: rewritten, relatedDocumentIds: Array.from(relatedDocumentIds), attachments };
}

export function normalizePage(
  rawContent: string,
  relativePath: string,
  index: Map<string, PageIndexEntry>,
  allFiles: Set<string>,
  diagnostics: DiagnosticCollector,
): { document: Document; attachments: Attachment[] } {
  const parsed = isNotionExportFile(relativePath);
  if (!parsed || parsed.ext !== "md") {
    throw new Error(`Not a Notion page file: ${relativePath}`);
  }

  const canonicalId = `notion:document:${parsed.parsed.notionId}`;
  const { content, relatedDocumentIds, attachments } = rewriteLinks(
    rawContent,
    relativePath,
    index,
    allFiles,
    diagnostics,
    canonicalId,
  );

  const document: Document = {
    id: canonicalId,
    type: "document",
    title: parsed.parsed.title,
    format: "markdown",
    content,
    parentId: resolveParentId(relativePath, index),
    relations: relatedDocumentIds.length > 0 ? relatedDocumentIds : undefined,
    attachments: attachments.length > 0 ? attachments.map((a) => a.id) : undefined,
    source: { service: "notion", sourceId: parsed.parsed.notionId, sourcePath: relativePath },
    metadata: { notion: { originalTitle: parsed.parsed.title } },
  };

  return { document, attachments };
}

export function normalizeDatabase(
  csvText: string,
  relativePath: string,
  index: Map<string, PageIndexEntry>,
  diagnostics: DiagnosticCollector,
): { collection: Collection; rows: Document[] } {
  const parsed = isNotionExportFile(relativePath);
  if (!parsed || parsed.ext !== "csv") {
    throw new Error(`Not a Notion database file: ${relativePath}`);
  }

  const collectionId = `notion:collection:${parsed.parsed.notionId}`;
  const collection: Collection = {
    id: collectionId,
    type: "collection",
    title: parsed.parsed.title,
    parentId: resolveParentId(relativePath, index),
    source: { service: "notion", sourceId: parsed.parsed.notionId, sourcePath: relativePath },
  };

  let table;
  try {
    table = parseCsvTable(csvText);
  } catch (err) {
    diagnostics.malformedSource(
      `Failed to parse database CSV: ${err instanceof Error ? err.message : String(err)}`,
      collectionId,
    );
    return { collection, rows: [] };
  }

  if (table.headers.length === 0) {
    diagnostics.warning(`Database has no columns`, collectionId);
    return { collection, rows: [] };
  }

  const titleColumn = table.headers.find((h) => h.toLowerCase() === "name") ?? table.headers[0];

  const rows: Document[] = table.rows.map((row, rowIndex) => {
    const title = titleColumn ? row[titleColumn] : undefined;
    const body = table.headers
      .filter((h) => h !== titleColumn)
      .map((h) => `- **${h}**: ${row[h] ?? ""}`)
      .join("\n");

    return {
      id: `${collectionId}:row-${rowIndex}`,
      type: "document",
      title: title && title.length > 0 ? title : undefined,
      format: "markdown",
      content: body,
      parentId: collectionId,
      source: {
        service: "notion",
        sourceId: `${parsed.parsed.notionId}:row-${rowIndex}`,
        sourcePath: relativePath,
      },
      metadata: { notion: { row: rowIndex, database: parsed.parsed.title } },
    };
  });

  return { collection, rows };
}
