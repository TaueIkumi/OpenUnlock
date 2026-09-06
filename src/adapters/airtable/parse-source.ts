import type { CsvTable } from "../../utils/csv.js";
import { parseCsvTable } from "../../utils/csv.js";
import type { InputSource } from "../../core/input.js";

/**
 * Airtable has no official "export the whole base" feature — only a
 * per-table CSV download from a grid view, with fully user-defined column
 * names. Unlike Linear's issue-key ids or ChatGPT/Claude's JSON shape,
 * there is no structural marker that reliably says "this CSV came from
 * Airtable" versus any other spreadsheet — except one: Airtable serves
 * attachment-field URLs from its own CDN domains, which show up verbatim
 * in exported cells. Detection is honest about this asymmetry (see
 * detect.ts): confident only when that CDN evidence is present, otherwise
 * low enough that `openunlock convert` asks the user for `--from airtable`
 * rather than guessing (AGENT.md section 8).
 */
export const AIRTABLE_CDN_PATTERN =
  /https:\/\/(?:dl\.airtable\.com|v\d+\.airtableusercontent\.com)\/[^\s")]+/i;

export function hasAirtableCdnEvidence(table: CsvTable): boolean {
  return table.rows
    .slice(0, 50)
    .some((row) => Object.values(row).some((value) => AIRTABLE_CDN_PATTERN.test(value)));
}

/** A minimal structural bar: a real header row. Arbitrary field names are expected. */
export function isPlausibleTable(table: CsvTable): boolean {
  return table.headers.length > 0;
}

/**
 * Find every `.csv` file in `input` that looks like a table export at all.
 * Airtable bases are often exported as several files (one per table), so —
 * unlike Trello/Linear's single-file `find...File` helpers — this collects
 * all of them.
 */
export async function findAirtableTables(
  input: InputSource,
): Promise<{ path: string; table: CsvTable; hasCdnEvidence: boolean }[]> {
  const files = await input.listFiles();
  const results: { path: string; table: CsvTable; hasCdnEvidence: boolean }[] = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".csv")) continue;
    const table = parseCsvTable(await input.readText(file));
    if (!isPlausibleTable(table)) continue;
    results.push({ path: file, table, hasCdnEvidence: hasAirtableCdnEvidence(table) });
  }

  return results;
}

/** Airtable's default download name is "<Table>-Grid view.csv"; strip the view suffix for a cleaner title. */
export function tableTitleFromFilename(relativePath: string): string {
  const base = relativePath.split("/").pop()!.replace(/\.csv$/i, "");
  return base.replace(/[-\s]+(?:grid|gallery|kanban|calendar|form)\s+view$/i, "").trim() || base;
}
