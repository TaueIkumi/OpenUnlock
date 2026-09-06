/**
 * Raw shapes for an official Slack workspace export (admin-initiated
 * "Export" ZIP): `channels.json`, `users.json` at the root, and one
 * directory per channel containing one JSON file per day
 * (`YYYY-MM-DD.json`), each holding an array of message objects.
 *
 * Fields are optional and loosely typed on purpose — see AGENT.md section
 * 21, Forward Compatibility.
 */

export interface SlackChannel {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SlackUserProfile {
  real_name?: string;
  display_name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  profile?: SlackUserProfile;
  is_bot?: boolean;
  [key: string]: unknown;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackFile {
  id?: string;
  name?: string;
  mimetype?: string;
  size?: number;
  url_private?: string;
  [key: string]: unknown;
}

export interface SlackMessage {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: SlackReaction[];
  files?: SlackFile[];
  [key: string]: unknown;
}

export function isSlackChannelsFile(data: unknown): data is SlackChannel[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const sample = data[0];
  return typeof sample === "object" && sample !== null && "id" in sample && "name" in sample;
}

export function isSlackUsersFile(data: unknown): data is SlackUser[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const sample = data[0];
  return typeof sample === "object" && sample !== null && "id" in sample;
}

export function isSlackMessageArray(data: unknown): data is SlackMessage[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const sample = data[0];
  return typeof sample === "object" && sample !== null && ("ts" in sample || "type" in sample);
}
