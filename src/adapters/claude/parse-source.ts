/**
 * Raw shape of a Claude.ai "Export data" `conversations.json`. Unlike
 * ChatGPT's tree-shaped `mapping` (a conversation can branch), Claude's
 * export is a flat, already-linear list of messages per conversation — no
 * branch reconstruction needed. The two formats share a filename but not a
 * schema, so detection keys off `chat_messages` rather than `mapping`.
 *
 * Fields are optional and loosely typed on purpose — see AGENT.md section
 * 21, Forward Compatibility.
 */

export interface ClaudeContentBlock {
  type?: string;
  text?: string;
}

export interface ClaudeAttachment {
  file_name?: string;
  file_size?: number;
  file_type?: string;
}

export interface ClaudeMessage {
  uuid?: string;
  text?: string;
  content?: ClaudeContentBlock[];
  sender?: string;
  created_at?: string;
  updated_at?: string;
  attachments?: ClaudeAttachment[];
  files?: unknown[];
}

export interface ClaudeConversation {
  uuid?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: ClaudeMessage[];
  [key: string]: unknown;
}

export function isPlausibleClaudeConversationsArray(data: unknown): data is ClaudeConversation[] {
  if (!Array.isArray(data)) {
    return false;
  }
  if (data.length === 0) {
    return true;
  }
  const sample = data[0];
  return typeof sample === "object" && sample !== null && "chat_messages" in sample;
}
