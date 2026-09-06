/**
 * Raw shapes for Discord's official "Request all my data" personal export:
 * `account/user.json`, `messages/index.json` (channel id -> display label),
 * and one directory per channel (`messages/c<id>/`) holding `channel.json`
 * and `messages.json`.
 *
 * Two quirks worth calling out because they shape the whole adapter:
 *
 * 1. This is a *personal* data export — `messages.json` only ever contains
 *    messages the exporting account itself sent, never other participants'
 *    content (Discord's privacy design). There is no per-message author
 *    field at all; every message is implicitly authored by the account
 *    owner.
 * 2. Attachments appear only as CDN URLs (which expire and require
 *    authentication), never as bytes — same constraint as Slack's export.
 *
 * Fields are optional and loosely typed on purpose — see AGENT.md section
 * 21, Forward Compatibility.
 */

export interface DiscordUser {
  id?: string;
  username?: string;
  email?: string;
  [key: string]: unknown;
}

export interface DiscordChannelGuild {
  id?: string;
  name?: string;
}

export interface DiscordChannel {
  id?: string;
  type?: number;
  name?: string;
  guild?: DiscordChannelGuild;
  recipients?: string[];
  [key: string]: unknown;
}

export interface DiscordMessage {
  ID?: string;
  Timestamp?: string;
  Contents?: string;
  Attachments?: string;
  [key: string]: unknown;
}

export type DiscordChannelIndex = Record<string, string>;

export function isDiscordChannelIndex(data: unknown): data is DiscordChannelIndex {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const entries = Object.entries(data as Record<string, unknown>);
  return entries.length === 0 || entries.every(([, value]) => typeof value === "string");
}

export function isDiscordMessageArray(data: unknown): data is DiscordMessage[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const sample = data[0];
  return typeof sample === "object" && sample !== null && ("ID" in sample || "Timestamp" in sample);
}

/** `messages/c<channelId>/messages.json`. */
export const CHANNEL_DIR_PATTERN = /^messages\/c([^/]+)\/messages\.json$/;

/**
 * Discord's export timestamp (`YYYY-MM-DD HH:MM:SS`, always UTC, no
 * offset marker) — not ISO 8601, so the shared normalizeTimestamp() can't
 * parse it directly.
 */
export function normalizeDiscordTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!match) return undefined;
  const iso = `${match[1]}T${match[2]}.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : iso;
}
