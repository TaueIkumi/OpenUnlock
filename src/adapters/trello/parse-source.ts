/**
 * Raw shape of a Trello board "Export as JSON" file. Fields are optional
 * and loosely typed on purpose: unknown/additional vendor fields must not
 * break parsing (AGENT.md section 21, Forward Compatibility).
 */

import type { InputSource } from "../../core/input.js";

export interface TrelloMember {
  id: string;
  fullName?: string;
  username?: string;
}

export interface TrelloLabel {
  id: string;
  name?: string;
  color?: string | null;
}

export interface TrelloAttachment {
  id: string;
  name?: string;
  url?: string;
  bytes?: number | null;
  mimeType?: string;
}

export interface TrelloChecklistItem {
  id: string;
  name: string;
  state?: string;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  idCard: string;
  checkItems?: TrelloChecklistItem[];
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard?: string;
  closed?: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idBoard?: string;
  closed?: boolean;
  due?: string | null;
  dateLastActivity?: string | null;
  idMembers?: string[];
  labels?: TrelloLabel[];
  shortUrl?: string;
  url?: string;
  pos?: number;
  attachments?: TrelloAttachment[];
  [key: string]: unknown;
}

export interface TrelloActionData {
  text?: string;
  card?: { id?: string; name?: string };
  [key: string]: unknown;
}

export interface TrelloAction {
  id: string;
  type: string;
  date?: string;
  idMemberCreator?: string;
  data?: TrelloActionData;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  closed?: boolean;
  url?: string;
  dateLastActivity?: string | null;
  lists?: TrelloList[];
  cards?: TrelloCard[];
  members?: TrelloMember[];
  actions?: TrelloAction[];
  checklists?: TrelloChecklist[];
  [key: string]: unknown;
}

/**
 * Structural check for "this is a Trello board export", independent of
 * filename — Trello exports as a single arbitrarily-named JSON file
 * (AGENT.md section 8, Detection should inspect structural markers).
 */
export function isPlausibleTrelloBoard(data: unknown): data is TrelloBoard {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.name === "string" && Array.isArray(obj.lists) && Array.isArray(obj.cards);
}

/**
 * Trello ids are MongoDB ObjectIds: the first 4 bytes (8 hex chars) encode
 * the id's creation time as Unix seconds. Trello's own JSON export doesn't
 * otherwise expose a `dateCreated` field for boards, lists, cards, or
 * members, so this is the only way to recover that timestamp without
 * calling Trello's API. Returns undefined for anything that isn't a
 * 24-char hex ObjectId (e.g. synthetic ids in tests/fixtures).
 */
export function timestampFromObjectId(id: string): string | undefined {
  if (!/^[0-9a-f]{24}$/i.test(id)) {
    return undefined;
  }
  const seconds = parseInt(id.slice(0, 8), 16);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : undefined;
}

/**
 * Find the JSON file within `input` that looks like a Trello board export.
 * Trello exports don't use a fixed filename, so every `.json` file is a
 * candidate; the first one that structurally matches wins.
 */
export async function findBoardFile(input: InputSource): Promise<string | undefined> {
  const files = await input.listFiles();
  for (const file of files) {
    if (!file.toLowerCase().endsWith(".json")) continue;
    try {
      const data: unknown = JSON.parse(await input.readText(file));
      if (isPlausibleTrelloBoard(data)) {
        return file;
      }
    } catch {
      // Not JSON, or not this file — keep scanning.
    }
  }
  return undefined;
}
