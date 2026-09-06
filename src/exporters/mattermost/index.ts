import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type {
  AnyCanonicalEntity,
  Conversation,
  Message,
  Person,
  Workspace,
} from "../../core/canonical/types.js";
import {
  buildManifest,
  countByType,
  ensureOutputDir,
  serializeDiagnostics,
  sortEntitiesDeterministically,
  writeJsonFile,
  writeTextFile,
} from "../shared.js";
import {
  PLACEHOLDER_PASSWORD,
  threadMessages,
  toEpochMillis,
  toMattermostChannelName,
  toMattermostEmail,
  toMattermostTeamName,
  toMattermostUsername,
} from "./mapping.js";

/**
 * Mattermost's official bulk-import format (`mmctl import bulk`): one JSON
 * object per line, always starting with a version line. See mapping.ts
 * for the field-mapping rationale and its accuracy caveat.
 */
export const mattermostExporter: Exporter = {
  id: "mattermost",

  async export(
    entities: AsyncIterable<AnyCanonicalEntity>,
    context: ExportContext,
  ): Promise<ExportResult> {
    await ensureOutputDir(context);

    const collected: AnyCanonicalEntity[] = [];
    for await (const entity of entities) {
      collected.push(entity);
    }

    const sorted = sortEntitiesDeterministically(collected);
    const entityCounts = countByType(sorted);
    const manifest = buildManifest(context.sourceService, entityCounts);

    const workspaces = sorted.filter((e): e is Workspace => e.type === "workspace");
    const conversations = sorted.filter((e): e is Conversation => e.type === "conversation");
    const people = sorted.filter((e): e is Person => e.type === "person");
    const messages = sorted.filter((e): e is Message => e.type === "message");

    if (people.length > 0) {
      context.diagnostics.warning(
        `${people.length} user(s) were assigned the placeholder password "${PLACEHOLDER_PASSWORD}" ` +
          "(source exports never contain real passwords) — force a password reset for all imported " +
          "users before allowing login.",
      );
    }

    const teamName = toMattermostTeamName(workspaces[0], context.sourceService);
    const usernameById = new Map(people.map((p) => [p.id, toMattermostUsername(p)]));

    const lines: unknown[] = [];
    lines.push({ type: "version", version: 1 });
    lines.push({
      type: "team",
      team: { name: teamName, display_name: workspaces[0]?.title ?? teamName, type: "O" },
    });

    for (const conversation of conversations) {
      lines.push({
        type: "channel",
        channel: {
          team: teamName,
          name: toMattermostChannelName(conversation),
          display_name: conversation.title ?? toMattermostChannelName(conversation),
          type: "O",
        },
      });
    }

    for (const person of people) {
      const username = usernameById.get(person.id)!;
      lines.push({
        type: "user",
        user: {
          username,
          email: toMattermostEmail(person, username),
          password: PLACEHOLDER_PASSWORD,
          teams: [{ name: teamName, channels: conversations.map((c) => ({ name: toMattermostChannelName(c) })) }],
        },
      });
    }

    const messagesByConversation = new Map<string, Message[]>();
    for (const message of messages) {
      if (!message.conversationId) continue;
      const list = messagesByConversation.get(message.conversationId) ?? [];
      list.push(message);
      messagesByConversation.set(message.conversationId, list);
    }

    for (const conversation of conversations) {
      const channelName = toMattermostChannelName(conversation);
      const conversationMessages = messagesByConversation.get(conversation.id) ?? [];
      const threads = threadMessages(conversationMessages);

      for (const { rootMessage, replies } of threads) {
        const rootUsername = rootMessage.authorId ? usernameById.get(rootMessage.authorId) : undefined;
        if (!rootUsername) {
          context.diagnostics.missingReference(
            `Message has no known author; skipped in Mattermost export`,
            rootMessage.id,
          );
          continue;
        }

        const post: Record<string, unknown> = {
          team: teamName,
          channel: channelName,
          user: rootUsername,
          message: rootMessage.content,
          create_at: toEpochMillis(rootMessage.createdAt),
        };

        if (replies.length > 0) {
          const replyObjects = replies
            .map((reply) => {
              const username = reply.authorId ? usernameById.get(reply.authorId) : undefined;
              if (!username) {
                context.diagnostics.missingReference(
                  `Reply has no known author; skipped in Mattermost export`,
                  reply.id,
                );
                return undefined;
              }
              return { user: username, message: reply.content, create_at: toEpochMillis(reply.createdAt) };
            })
            .filter((r): r is NonNullable<typeof r> => r !== undefined);

          if (replyObjects.length > 0) {
            post.replies = replyObjects;
          }
        }

        lines.push({ type: "post", post });
      }
    }

    // One compact JSON object per line — never pretty-printed, per
    // Mattermost's bulk-import JSONL spec (unlike this project's other
    // JSON output, which is pretty-printed for readable diffs).
    const jsonl = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
    await writeTextFile(context, "mattermost-import.jsonl", jsonl);

    await writeJsonFile(context, "openunlock.json", manifest);
    await writeJsonFile(context, "diagnostics.json", serializeDiagnostics(context.diagnostics.all()));

    return { filesWritten: 3, entityCounts };
  },
};
