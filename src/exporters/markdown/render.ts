import type {
  AnyCanonicalEntity,
  Conversation,
  Document,
  Message,
  Person,
} from "../../core/canonical/types.js";

function frontmatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/**
 * Generic scheme any adapter may emit for a link to another canonical
 * entity: `openunlock://entity/<canonical-id>`. Resolved here, at export
 * time, because only the exporter knows the final output paths — keeping
 * adapters and exporters from needing to know about each other.
 */
const ENTITY_LINK_PATTERN = /openunlock:\/\/entity\/([^\s)]+)/g;

export function resolveEntityLinks(
  content: string,
  resolvePath: (id: string) => string | undefined,
  onUnresolved: (id: string) => void,
): string {
  return content.replace(ENTITY_LINK_PATTERN, (full, id: string) => {
    const resolved = resolvePath(id);
    if (resolved === undefined) {
      onUnresolved(id);
      return full;
    }
    return resolved;
  });
}

export function renderConversationMarkdown(
  conversation: Conversation,
  messagesById: Map<string, Message>,
  peopleById: Map<string, Person>,
): string {
  const header = frontmatter({
    title: conversation.title ?? "Untitled",
    source: conversation.source.service,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  });

  const body = conversation.messageIds
    .map((id) => messagesById.get(id))
    .filter((m): m is Message => m !== undefined)
    .map((message) => {
      const author = message.authorId ? peopleById.get(message.authorId) : undefined;
      const speaker = author?.displayName ?? author?.id ?? "unknown";
      const content = message.content.trim();
      if (content.length === 0) {
        return `### ${speaker}\n\n_[unsupported content — see diagnostics.json / canonical JSON]_\n`;
      }
      return `### ${speaker}\n\n${content}\n`;
    })
    .join("\n");

  return `${header}\n# ${conversation.title ?? "Untitled"}\n\n${body}\n`;
}

export function renderDocumentMarkdown(document: Document, resolvedContent: string): string {
  const header = frontmatter({
    title: document.title ?? "Untitled",
    source: document.source.service,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });

  if (document.format === "markdown") {
    return `${header}\n${resolvedContent}\n`;
  }

  return `${header}\n# ${document.title ?? "Untitled"}\n\n${resolvedContent}\n`;
}

export function groupById<T extends AnyCanonicalEntity>(entities: T[]): Map<string, T> {
  return new Map(entities.map((e) => [e.id, e]));
}
