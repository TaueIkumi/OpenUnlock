/**
 * Normalize a variety of source timestamp shapes into ISO 8601 (UTC).
 * Returns undefined (never throws) when a timestamp cannot be parsed —
 * callers should report malformed timestamps as diagnostics rather than
 * fail the whole conversion.
 */
export function normalizeTimestamp(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    // Unix epoch seconds (common in ChatGPT exports) vs milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return undefined;
}

/** Extract the YYYY-MM-DD date portion of an ISO timestamp, if present. */
export function isoDatePart(isoTimestamp: string | undefined): string | undefined {
  if (!isoTimestamp) {
    return undefined;
  }
  return isoTimestamp.slice(0, 10);
}
