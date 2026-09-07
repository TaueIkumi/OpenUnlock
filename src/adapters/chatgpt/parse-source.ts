/**
 * Raw shape of a ChatGPT `conversations.json` export. Fields are optional
 * and loosely typed on purpose: unknown/additional vendor fields must not
 * break parsing (AGENT.md section 21, Forward Compatibility).
 */

export interface ChatGptAuthor {
  role?: string;
  name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChatGptThought {
  summary?: string;
  content?: string;
  finished?: boolean;
}

export interface ChatGptContent {
  content_type?: string;
  parts?: unknown[];
  text?: string;
  /** Present on content_type "reasoning_recap": a short plain-text summary. */
  content?: string;
  /** Present on content_type "thoughts": a reasoning model's chain-of-thought steps. */
  thoughts?: ChatGptThought[];
}

export interface ChatGptMessage {
  id?: string;
  author?: ChatGptAuthor;
  create_time?: number | null;
  update_time?: number | null;
  content?: ChatGptContent;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatGptNode {
  id: string;
  message?: ChatGptMessage | null;
  parent?: string | null;
  children?: string[];
}

export interface ChatGptConversation {
  id?: string;
  conversation_id?: string;
  title?: string | null;
  create_time?: number | null;
  update_time?: number | null;
  mapping?: Record<string, ChatGptNode>;
  current_node?: string | null;
  [key: string]: unknown;
}

export function isPlausibleConversationsArray(data: unknown): data is ChatGptConversation[] {
  if (!Array.isArray(data)) {
    return false;
  }
  if (data.length === 0) {
    return true;
  }
  const sample = data[0];
  return (
    typeof sample === "object" &&
    sample !== null &&
    ("mapping" in sample || "conversation_id" in sample)
  );
}
