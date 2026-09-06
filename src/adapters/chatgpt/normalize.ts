import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Conversation, Message, Person } from "../../core/canonical/types.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import { slugify } from "../../utils/filenames.js";
import type { ChatGptConversation, ChatGptNode } from "./parse-source.js";

const SUPPORTED_CONTENT_TYPES = new Set(["text"]);

export interface NormalizedConversation {
  conversation: Conversation;
  messages: Message[];
  people: Person[];
}

function conversationSourceId(conversation: ChatGptConversation, index: number): string {
  return conversation.conversation_id ?? conversation.id ?? `index-${index}`;
}

function personId(role: string, name: string | null | undefined): string {
  const key = name ? `${role}:${slugify(name)}` : role;
  return `chatgpt:person:${key}`;
}

function renderContent(
  node: ChatGptNode,
  diagnostics: DiagnosticCollector,
  ref: string,
): { content: string; unsupported: boolean } {
  const content = node.message?.content;
  const contentType = content?.content_type ?? "unknown";

  if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
    diagnostics.unsupported(
      `Message content type "${contentType}" is not fully supported; raw content preserved in metadata`,
      ref,
    );
    return { content: "", unsupported: true };
  }

  const parts = content?.parts ?? [];
  const text = parts
    .filter((part): part is string => typeof part === "string")
    .join("\n\n")
    .trim();

  if (parts.length > 0 && text.length === 0) {
    diagnostics.unsupported(
      "Message has non-string content parts (e.g. multimodal content); raw content preserved in metadata",
      ref,
    );
    return { content: "", unsupported: true };
  }

  return { content: text, unsupported: false };
}

/**
 * Find the nearest ancestor node (walking `parent` links) that has a
 * non-null message, skipping ChatGPT's synthetic root/system nodes.
 */
function findParentMessageId(
  node: ChatGptNode,
  mapping: Record<string, ChatGptNode>,
): string | undefined {
  let current = node.parent ? mapping[node.parent] : undefined;
  while (current) {
    if (current.message?.id) {
      return current.message.id;
    }
    current = current.parent ? mapping[current.parent] : undefined;
  }
  return undefined;
}

export function normalizeConversation(
  raw: ChatGptConversation,
  index: number,
  diagnostics: DiagnosticCollector,
): NormalizedConversation {
  const sourceId = conversationSourceId(raw, index);
  const conversationId = `chatgpt:conversation:${sourceId}`;
  const mapping = raw.mapping ?? {};

  const messages: Message[] = [];
  const peopleById = new Map<string, Person>();
  const knownFields = new Set([
    "id",
    "conversation_id",
    "title",
    "create_time",
    "update_time",
    "mapping",
    "current_node",
  ]);
  const extraTopLevelFields = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !knownFields.has(key)),
  );

  const nodesWithMessages = Object.values(mapping)
    .filter((node): node is ChatGptNode & { message: NonNullable<ChatGptNode["message"]> } =>
      Boolean(node.message?.id),
    )
    .sort((a, b) => {
      const aTime = a.message.create_time ?? 0;
      const bTime = b.message.create_time ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.message.id!.localeCompare(b.message.id!);
    });

  for (const node of nodesWithMessages) {
    const msg = node.message;
    const ref = `${conversationId}#${msg.id}`;
    const role = msg.author?.role ?? "unknown";
    const authorName = msg.author?.name ?? undefined;

    const author = personId(role, authorName ?? null);
    if (!peopleById.has(author)) {
      peopleById.set(author, {
        id: author,
        type: "person",
        displayName: authorName ?? role,
        source: { service: "chatgpt" },
        metadata: { chatgpt: { role } },
      });
    }

    const { content, unsupported } = renderContent(node, diagnostics, ref);
    const parentMessageId = findParentMessageId(node, mapping);

    if (!node.parent && Object.keys(mapping).length > 1 && !parentMessageId) {
      // top-of-tree message with no ancestor message; nothing to warn about.
    }

    const message: Message = {
      id: `chatgpt:message:${msg.id}`,
      type: "message",
      conversationId,
      authorId: author,
      parentMessageId: parentMessageId ? `chatgpt:message:${parentMessageId}` : undefined,
      content,
      createdAt: normalizeTimestamp(msg.create_time),
      updatedAt: normalizeTimestamp(msg.update_time),
      source: {
        service: "chatgpt",
        sourceId: msg.id,
      },
      metadata: {
        chatgpt: {
          nodeId: node.id,
          status: msg.status,
          contentType: msg.content?.content_type,
          ...(unsupported ? { rawContent: msg.content } : {}),
        },
      },
    };

    if (!msg.create_time) {
      diagnostics.malformedSource(`Message is missing create_time`, ref);
    }

    messages.push(message);
  }

  if (messages.length === 0) {
    diagnostics.warning(`Conversation has no messages`, conversationId);
  }

  const conversation: Conversation = {
    id: conversationId,
    type: "conversation",
    title: raw.title ?? undefined,
    createdAt: normalizeTimestamp(raw.create_time),
    updatedAt: normalizeTimestamp(raw.update_time),
    participantIds: Array.from(peopleById.keys()),
    messageIds: messages.map((m) => m.id),
    source: {
      service: "chatgpt",
      sourceId,
    },
    metadata: {
      chatgpt: {
        currentNode: raw.current_node ?? undefined,
        branchCount: nodesWithMessages.length,
        ...(Object.keys(extraTopLevelFields).length > 0 ? { extraFields: extraTopLevelFields } : {}),
      },
    },
  };

  return { conversation, messages, people: Array.from(peopleById.values()) };
}
