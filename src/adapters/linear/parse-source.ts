import type { CsvTable } from "../../utils/csv.js";
import { parseCsvTable } from "../../utils/csv.js";
import type { InputSource } from "../../core/input.js";

/**
 * Linear's "Export CSV" (from an issue list view) has no fixed schema
 * version and its exact column names have shifted across Linear releases,
 * so column access goes through `findColumn`, which tries a list of known
 * aliases rather than one hardcoded name (AGENT.md section 21, Forward
 * Compatibility).
 *
 * The one structural marker that has stayed stable is the issue key format
 * (`<TEAM-KEY>-<number>`, e.g. "ENG-42"), which detection relies on.
 */
export const ISSUE_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

const COLUMN_ALIASES: Record<string, string[]> = {
  id: ["ID", "Issue ID", "Identifier"],
  title: ["Title", "Name"],
  description: ["Description"],
  status: ["Status", "State"],
  priority: ["Priority"],
  assignee: ["Assignee", "Assignee Name"],
  labels: ["Labels", "Label"],
  team: ["Team", "Team Name"],
  cycle: ["Cycle", "Cycle Name"],
  project: ["Project", "Project Name"],
  created: ["Created", "Created At", "CreatedAt"],
  updated: ["Updated", "Updated At", "UpdatedAt"],
  parent: ["Parent issue", "Parent Issue", "Parent", "Parent ID"],
  url: ["URL", "Url"],
};

export function findColumn(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES): string | undefined {
  for (const alias of COLUMN_ALIASES[field] ?? []) {
    const value = row[alias];
    if (value !== undefined && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function resolveHeader(headers: string[], field: keyof typeof COLUMN_ALIASES): string | undefined {
  return headers.find((h) => (COLUMN_ALIASES[field] ?? []).includes(h));
}

/**
 * Structural check: at least an id-shaped and title-ish column, and at
 * least one other Linear-specific column (team/cycle/URL containing
 * "linear.app") — filenames aren't checked at all, since users rename
 * downloaded CSVs freely.
 */
export function isPlausibleLinearExport(table: CsvTable): boolean {
  const hasId = resolveHeader(table.headers, "id") !== undefined;
  const hasTitle = resolveHeader(table.headers, "title") !== undefined;
  if (!hasId || !hasTitle) {
    return false;
  }

  const hasLinearSpecificColumn =
    resolveHeader(table.headers, "team") !== undefined ||
    resolveHeader(table.headers, "cycle") !== undefined ||
    resolveHeader(table.headers, "url") !== undefined;

  if (!hasLinearSpecificColumn) {
    return false;
  }

  if (table.rows.length === 0) {
    return true;
  }

  // Only rows that actually have an id value need to look like an issue
  // key — a handful of blank ids (later skipped during normalization, with
  // a diagnostic) shouldn't sink detection of an otherwise-valid export.
  const idsToCheck = table.rows
    .slice(0, 20)
    .map((row) => findColumn(row, "id"))
    .filter((id): id is string => id !== undefined);

  return idsToCheck.length > 0 && idsToCheck.every((id) => ISSUE_ID_PATTERN.test(id));
}

/**
 * Find the CSV file within `input` that looks like a Linear issue export.
 * Linear doesn't use a fixed filename, so every `.csv` file is a candidate.
 */
export async function findLinearFile(
  input: InputSource,
): Promise<{ path: string; table: CsvTable } | undefined> {
  const files = await input.listFiles();
  for (const file of files) {
    if (!file.toLowerCase().endsWith(".csv")) continue;
    const table = parseCsvTable(await input.readText(file));
    if (isPlausibleLinearExport(table)) {
      return { path: file, table };
    }
  }
  return undefined;
}
