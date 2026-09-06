import path from "node:path";

/**
 * Notion's "Export as Markdown & CSV" appends a 32-character hex id to every
 * page/database filename: `<Title> <id>.md` / `<Title> <id>.csv`. Nested
 * pages are exported as a sibling directory sharing the same base name as
 * the parent's file (minus extension).
 */
export const NOTION_ID_PATTERN = /^(.*?)\s([0-9a-f]{32})$/i;

export interface ParsedNotionName {
  title: string;
  notionId: string;
}

export function parseNotionBasename(basenameWithoutExt: string): ParsedNotionName | null {
  const match = NOTION_ID_PATTERN.exec(basenameWithoutExt);
  if (!match) return null;
  const [, title, notionId] = match;
  return { title: title!, notionId: notionId!.toLowerCase() };
}

export function isNotionExportFile(relativePath: string): { ext: "md" | "csv"; parsed: ParsedNotionName } | null {
  const ext = path.posix.extname(relativePath).slice(1).toLowerCase();
  if (ext !== "md" && ext !== "csv") return null;
  const basename = path.posix.basename(relativePath, "." + ext);
  const parsed = parseNotionBasename(basename);
  if (!parsed) return null;
  return { ext, parsed };
}

/**
 * The directory a nested page's file lives in, if any, expressed as the
 * `.md` path of the parent page (Notion mirrors the parent's filename as
 * the containing directory name for its children).
 */
export function parentMdPathFor(relativePath: string): string | undefined {
  const dir = path.posix.dirname(relativePath);
  if (dir === "." || dir === "") return undefined;
  return `${dir}.md`;
}

/** Extract the first 32-hex-character Notion id found in a decoded string, if any. */
export function extractNotionId(decoded: string): string | undefined {
  const basename = path.posix.basename(decoded).replace(/\.(md|csv)$/i, "");
  const parsed = parseNotionBasename(basename);
  return parsed?.notionId;
}
