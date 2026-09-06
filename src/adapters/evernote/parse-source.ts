import { XMLParser } from "fast-xml-parser";
import type { InputSource } from "../../core/input.js";

/**
 * Raw shape of a parsed Evernote `.enex` export. Evernote's own export
 * format has no notion of a "notebook" beyond the file itself (a single
 * .enex holds one notebook's notes, named by the file), and no per-note
 * id beyond title + created time — both are quirks reflected in how the
 * adapter derives canonical ids.
 */
export interface EvernoteResource {
  /** Raw decoded bytes, if the resource had a <data encoding="base64"> block. */
  data?: Buffer;
  mime?: string;
  fileName?: string;
}

export interface EvernoteNote {
  title?: string;
  /** Raw ENML content, with the outer <en-note>...</en-note> wrapper stripped. */
  contentHtml: string;
  created?: string;
  updated?: string;
  tags: string[];
  author?: string;
  sourceUrl?: string;
  resources: EvernoteResource[];
}

export interface EvernoteExport {
  exportDate?: string;
  notes: EvernoteNote[];
}

interface RawXml {
  "en-export"?: {
    note?: RawNote | RawNote[];
    "@_export-date"?: string;
  };
}

interface RawNote {
  title?: string;
  content?: string | { __cdata?: string };
  created?: string;
  updated?: string;
  tag?: string | string[];
  "note-attributes"?: {
    author?: string;
    "source-url"?: string;
  };
  resource?: RawResource | RawResource[];
}

interface RawResource {
  data?: string | { "#text"?: string; "@_encoding"?: string };
  mime?: string;
  "resource-attributes"?: {
    "file-name"?: string;
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  // Evernote notes/resources/tags are frequently singular; force arrays so
  // downstream code doesn't special-case "one item vs many".
  isArray: (name) => ["note", "tag", "resource"].includes(name),
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function extractCdataOrText(value: string | { __cdata?: string } | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value.__cdata ?? "";
}

/** Strip the outer <?xml ...?><!DOCTYPE ...><en-note>...</en-note> ENML wrapper, keeping the inner markup. */
function stripEnNoteWrapper(enml: string): string {
  const match = enml.match(/<en-note[^>]*>([\s\S]*)<\/en-note>/);
  return match ? match[1]!.trim() : enml.trim();
}

function parseResource(raw: RawResource): EvernoteResource {
  let data: Buffer | undefined;
  if (typeof raw.data === "string") {
    data = Buffer.from(raw.data.replace(/\s+/g, ""), "base64");
  } else if (raw.data?.["#text"]) {
    data = Buffer.from(raw.data["#text"].replace(/\s+/g, ""), "base64");
  }

  return {
    data,
    mime: raw.mime,
    fileName: raw["resource-attributes"]?.["file-name"],
  };
}

function parseNote(raw: RawNote): EvernoteNote {
  return {
    title: raw.title,
    contentHtml: stripEnNoteWrapper(extractCdataOrText(raw.content)),
    created: raw.created,
    updated: raw.updated,
    tags: asArray(raw.tag),
    author: raw["note-attributes"]?.author,
    sourceUrl: raw["note-attributes"]?.["source-url"],
    resources: asArray(raw.resource).map(parseResource),
  };
}

/**
 * Parse and structurally validate an .enex export. Returns undefined if
 * `text` isn't XML, or doesn't have the expected <en-export><note>...
 * shape — callers treat that as "not an Evernote export" rather than an
 * error, since detection scans every file in the input.
 *
 * fast-xml-parser is a non-validating, pure-JS parser: it never resolves
 * the external DTD referenced in .enex's <!DOCTYPE> declaration, so this
 * cannot trigger XXE or a network fetch (AGENT.md section 2.1, Local-first;
 * section 17, Security).
 */
export function parseEvernoteExport(text: string): EvernoteExport | undefined {
  let raw: RawXml;
  try {
    raw = parser.parse(text) as RawXml;
  } catch {
    return undefined;
  }

  const root = raw["en-export"];
  if (!root || typeof root !== "object") {
    return undefined;
  }

  return {
    exportDate: root["@_export-date"],
    notes: asArray(root.note).map(parseNote),
  };
}

/**
 * Find the .enex file within `input`. Evernote always uses that extension,
 * but detection still validates structure rather than trusting it alone
 * (AGENT.md section 8) — a same-extension file that doesn't parse as an
 * Evernote export is skipped, not treated as a match.
 */
export async function findEvernoteFile(
  input: InputSource,
): Promise<{ path: string; parsed: EvernoteExport } | undefined> {
  const files = await input.listFiles();
  const candidates = files.filter((f) => f.toLowerCase().endsWith(".enex"));
  for (const file of candidates) {
    const parsed = parseEvernoteExport(await input.readText(file));
    if (parsed) {
      return { path: file, parsed };
    }
  }
  return undefined;
}

/**
 * Convert Evernote's compact timestamp format (`YYYYMMDDTHHMMSSZ`) to ISO
 * 8601. Not a general-purpose date parser — Evernote never emits any other
 * shape for <created>/<updated>.
 */
export function normalizeEvernoteTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : iso;
}
