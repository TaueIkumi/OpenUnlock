import type { InputSource } from "../../core/input.js";

/**
 * Raw shape of a Google Takeout "Gemini" export's `gemini_gems_data.html`
 * — a "Gem" is Gemini's equivalent of a ChatGPT Custom GPT: a name, a
 * block of custom instructions, and optionally a list of attached files
 * (referenced by an authenticated Google-hosted URL, never included as
 * bytes). There is no JSON export for this — only this HTML file.
 *
 * A real Google Takeout "Gemini" export contains no conversation history
 * at all as of this writing — only Gems and (usually empty) scheduled
 * actions. This adapter is scoped to exactly what's actually exportable;
 * see AGENT.md section 32 for why a Google Takeout module should be
 * scoped like any other single-source adapter, not guessed at.
 *
 * The HTML has no JSON `kind` field or similar to key off, and its field
 * *labels* ("名前:", "カスタム指示:") are in the Google account's own
 * display language — parsing therefore never reads label text, only the
 * structural position of each `<b>...:</b>` marker (1st = name, 2nd =
 * instructions, optional 3rd = a file list), so this works regardless of
 * language.
 */

export interface GeminiGemFile {
  url: string;
  filename: string;
}

export interface GeminiGem {
  name: string;
  instructions: string;
  files: GeminiGemFile[];
}

const LABEL_PATTERN = /<b>[^<]*:<\/b>/g;
const LINK_PATTERN = /<a href="([^"]*)">([^<]*)<\/a>/g;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function cleanValue(raw: string): string {
  return decodeHtmlEntities(raw.replace(/(<br\s*\/?>)+$/i, "")).trim();
}

/**
 * Parse one Gem's HTML fragment. Values are sliced positionally between
 * consecutive `<b>...:</b>` markers — the label text itself is discarded,
 * since it's locale-dependent and never needed for parsing.
 */
function parseGemChunk(chunk: string): GeminiGem | undefined {
  const labels = [...chunk.matchAll(LABEL_PATTERN)];
  if (labels.length < 2) {
    return undefined;
  }

  const valueAfter = (index: number): string => {
    const start = labels[index]!.index + labels[index]![0].length;
    const end = index + 1 < labels.length ? labels[index + 1]!.index : chunk.length;
    return chunk.slice(start, end);
  };

  const name = cleanValue(valueAfter(0));
  const instructions = cleanValue(valueAfter(1));

  const files: GeminiGemFile[] = [];
  if (labels.length >= 3) {
    for (const match of valueAfter(2).matchAll(LINK_PATTERN)) {
      files.push({ url: decodeHtmlEntities(match[1]!), filename: decodeHtmlEntities(match[2]!) });
    }
  }

  return { name, instructions, files };
}

/**
 * Parse the full `gemini_gems_data.html` body. Gems are separated by
 * `<br><br>` immediately preceding the next Gem's opening `<b>` tag —
 * this correctly splits both a file-less Gem (2 trailing `<br>`s) and one
 * with a file list (3 trailing `<br>`s), since only the last two matter.
 */
export function parseGeminiGems(html: string): GeminiGem[] {
  const inner = html.match(/<div>([\s\S]*)<\/div>/i)?.[1] ?? html;
  if (inner.trim().length === 0) {
    return [];
  }

  return inner
    .split(/<br><br>(?=<b>)/)
    .map(parseGemChunk)
    .filter((gem): gem is GeminiGem => gem !== undefined);
}

/** True for a structurally empty Takeout HTML fragment: `<div></div>` (whitespace-tolerant). */
export function isEmptyTakeoutFragment(html: string): boolean {
  const inner = html.match(/<div>([\s\S]*)<\/div>/i)?.[1] ?? html;
  return inner.trim().length === 0;
}

const GEMS_FILENAME = "gemini_gems_data.html";
const SCHEDULED_ACTIONS_FILENAME = "gemini_scheduled_actions_data.html";

/**
 * Detection requires both the fixed Takeout-generated filename (Gemini's
 * export has no other structural marker like a JSON `kind` field to key
 * off) and a successful structural parse — a same-named file with
 * unrelated content still won't be treated as a match.
 */
export async function findGeminiGemsFile(
  input: InputSource,
): Promise<{ path: string; gems: GeminiGem[] } | undefined> {
  const files = await input.listFiles();
  for (const file of files) {
    if (!file.toLowerCase().endsWith(GEMS_FILENAME)) continue;
    const html = await input.readText(file);
    if (isEmptyTakeoutFragment(html)) {
      return { path: file, gems: [] };
    }
    const gems = parseGeminiGems(html);
    if (gems.length > 0) {
      return { path: file, gems };
    }
  }
  return undefined;
}

/** The sibling scheduled-actions file, if present — see normalize.ts for why it's not parsed. */
export async function findScheduledActionsFile(input: InputSource): Promise<string | undefined> {
  const files = await input.listFiles();
  return files.find((f) => f.toLowerCase().endsWith(SCHEDULED_ACTIONS_FILENAME));
}
