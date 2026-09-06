import type { InputSource } from "../../core/input.js";

/**
 * Raw shape of a note in a Google Takeout "Keep" export — one `.json`
 * file per note (Takeout also writes a sibling `.html` file per note,
 * which this adapter ignores in favor of the structured JSON), with
 * attachment files sitting alongside the note JSON in the same directory.
 *
 * This is a single Takeout *module*, not a general Takeout adapter — see
 * AGENT.md section 32's note on why a whole-Takeout adapter isn't the
 * right shape (it bundles many unrelated per-service formats).
 *
 * Notes have no note-id field of their own in the export, so canonical
 * ids are derived from a content fingerprint (see normalize.ts). Fields
 * are optional and loosely typed on purpose — see AGENT.md section 21,
 * Forward Compatibility.
 */

export interface GoogleKeepLabel {
  name?: string;
}

export interface GoogleKeepListItem {
  text?: string;
  isChecked?: boolean;
}

export interface GoogleKeepAttachment {
  filePath?: string;
  mimetype?: string;
}

export interface GoogleKeepNote {
  title?: string;
  textContent?: string;
  listContent?: GoogleKeepListItem[];
  isTrashed?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  color?: string;
  createdTimestampUsec?: number;
  userEditedTimestampUsec?: number;
  labels?: GoogleKeepLabel[];
  attachments?: GoogleKeepAttachment[];
  [key: string]: unknown;
}

/**
 * Structural check, not filename-based: Takeout's Keep export is the only
 * common source of JSON files carrying this exact trio of boolean
 * "is*" flags. Deliberately doesn't also require a timestamp field here —
 * that's checked at normalize time instead (as a malformed-source
 * diagnostic, not a detection gate), so a note missing one is still
 * recognized and converted rather than silently skipped.
 */
export function isPlausibleGoogleKeepNote(data: unknown): data is GoogleKeepNote {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.isTrashed === "boolean" &&
    typeof obj.isPinned === "boolean" &&
    typeof obj.isArchived === "boolean"
  );
}

export async function findGoogleKeepNotes(
  input: InputSource,
): Promise<{ path: string; note: GoogleKeepNote }[]> {
  const files = await input.listFiles();
  const results: { path: string; note: GoogleKeepNote }[] = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".json")) continue;
    let data: unknown;
    try {
      data = JSON.parse(await input.readText(file));
    } catch {
      continue;
    }
    if (isPlausibleGoogleKeepNote(data)) {
      results.push({ path: file, note: data });
    }
  }

  return results;
}

/** Microseconds since epoch (Keep's own unit) -> ISO 8601. */
export function normalizeKeepTimestamp(usec: number | undefined): string | undefined {
  if (usec === undefined) return undefined;
  const date = new Date(usec / 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
