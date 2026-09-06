import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Conversation, Message, Person } from "../../core/canonical/types.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import { slugify } from "../../utils/filenames.js";
import type { ClaudeConversation, ClaudeMessage } from "./parse-source.js";

export interface NormalizedConversation {
  conversation: Conversation;
  messages: Message[];
  people: Person[];
}

function personId(sender: string): string {
  return `claude:person:${slugify(sender)}`;
}

function displayNameForSender(sender: string): string {
  if (sender === "human") return "You";
  if (sender === "assistant") return "Claude";
  return sender;
}

function renderContent(raw: ClaudeMessage, diagnostics: DiagnosticCollector, ref: string): string {
  if (Array.isArray(raw.content) && raw.content.length > 0) {
    const text = raw.content
      .filter((block) => block.type === undefined || block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n\n")
      .trim();

    if (text.length > 0) {
      return text;
    }

    diagnostics.unsupported(
      "Message content has no text blocks (e.g. tool use or image blocks); raw content preserved in metadata",
      ref,
    );
    return "";
  }

  return (raw.text ?? "").trim();
}

export function normalizeConversation(
  raw: ClaudeConversation,
  index: number,
  diagnostics: DiagnosticCollector,
): NormalizedConversation {
  const sourceId = raw.uuid ?? `index-${index}`;
  const conversationId = `claude:conversation:${sourceId}`;

  const knownFields = new Set(["uuid", "name", "created_at", "updated_at", "chat_messages", "account"]);
  const extraTopLevelFields = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !knownFields.has(key)),
  );

  const peopleById = new Map<string, Person>();
  const rawMessages = raw.chat_messages ?? [];

  const messages: Message[] = rawMessages.map((msg, msgIndex) => {
    const msgId = msg.uuid ?? `${sourceId}:index-${msgIndex}`;
    const ref = `${conversationId}#${msgId}`;
    const sender = msg.sender ?? "unknown";

    const author = personId(sender);
    if (!peopleById.has(author)) {
      peopleById.set(author, {
        id: author,
        type: "person",
        displayName: displayNameForSender(sender),
        source: { service: "claude" },
        metadata: { claude: { sender } },
      });
    }

    const content = renderContent(msg, diagnostics, ref);
    if (content.length === 0 && !(Array.isArray(msg.content) && msg.content.length > 0)) {
      diagnostics.malformedSource("Message has no text content", ref);
    }

    const attachmentCount = (msg.attachments?.length ?? 0) + (msg.files?.length ?? 0);
    if (attachmentCount > 0) {
      diagnostics.lossyConversion(
        `Message has ${attachmentCount} attachment(s)/file(s); the export does not include their bytes`,
        ref,
      );
    }

    if (!msg.created_at) {
      diagnostics.malformedSource("Message is missing created_at", ref);
    }

    // Claude's export is already a flat, linear list — no tree to walk,
    // unlike ChatGPT's branching `mapping`.
    const previous = msgIndex > 0 ? rawMessages[msgIndex - 1] : undefined;
    const parentMessageId = previous ? `claude:message:${previous.uuid ?? `${sourceId}:index-${msgIndex - 1}`}` : undefined;

    return {
      id: `claude:message:${msgId}`,
      type: "message",
      conversationId,
      authorId: author,
      parentMessageId,
      content,
      createdAt: normalizeTimestamp(msg.created_at),
      updatedAt: normalizeTimestamp(msg.updated_at),
      source: { service: "claude", sourceId: msg.uuid },
      metadata: {
        claude: {
          sender,
          attachments: msg.attachments,
          fileCount: msg.files?.length,
        },
      },
    } satisfies Message;
  });

  if (messages.length === 0) {
    diagnostics.warning("Conversation has no messages", conversationId);
  }

  const conversation: Conversation = {
    id: conversationId,
    type: "conversation",
    title: raw.name || undefined,
    createdAt: normalizeTimestamp(raw.created_at),
    updatedAt: normalizeTimestamp(raw.updated_at),
    participantIds: Array.from(peopleById.keys()),
    messageIds: messages.map((m) => m.id),
    source: { service: "claude", sourceId: raw.uuid },
    metadata: {
      claude: {
        ...(Object.keys(extraTopLevelFields).length > 0 ? { extraFields: extraTopLevelFields } : {}),
      },
    },
  };

  return { conversation, messages, people: Array.from(peopleById.values()) };
}
