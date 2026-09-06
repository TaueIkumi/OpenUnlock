import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Conversation, Message, Person } from "../../core/canonical/types.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import { renderSlackText, type SlackTextContext } from "./render-text.js";
import type { SlackChannel, SlackMessage, SlackUser } from "./parse-source.js";

export function personIdForUser(userId: string): string {
  return `slack:person:${userId}`;
}

export function personIdForBot(botId: string): string {
  return `slack:person:bot:${botId}`;
}

export function normalizeUser(raw: SlackUser): Person {
  const displayName = raw.profile?.display_name || raw.real_name || raw.name || raw.id;
  return {
    id: personIdForUser(raw.id),
    type: "person",
    displayName,
    email: raw.profile?.email,
    source: { service: "slack", sourceId: raw.id },
    metadata: { slack: { isBot: raw.is_bot ?? false } },
  };
}

export function syntheticBotPerson(botId: string): Person {
  return {
    id: personIdForBot(botId),
    type: "person",
    displayName: `Bot ${botId}`,
    source: { service: "slack", sourceId: botId },
    metadata: { slack: { isBot: true, syntheticFromBotId: true } },
  };
}

function tsToMillis(ts: string): number {
  return Math.round(parseFloat(ts) * 1000);
}

export function normalizeChannelMessages(
  channel: SlackChannel,
  rawMessages: SlackMessage[],
  context: SlackTextContext,
  diagnostics: DiagnosticCollector,
): { conversation: Conversation; messages: Message[]; botIdsUsed: Set<string> } {
  const conversationId = `slack:conversation:${channel.id}`;
  const botIdsUsed = new Set<string>();
  const participantIds = new Set<string>();

  const withTs = rawMessages.filter((m): m is SlackMessage & { ts: string } => {
    if (!m.ts) {
      diagnostics.malformedSource(`Message is missing "ts" and was skipped`, conversationId);
      return false;
    }
    return true;
  });

  withTs.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  const tsSet = new Set(withTs.map((m) => m.ts));

  const messages: Message[] = withTs.map((raw) => {
    const ref = `${conversationId}#${raw.ts}`;
    let authorId: string | undefined;

    if (raw.user) {
      authorId = personIdForUser(raw.user);
      participantIds.add(authorId);
    } else if (raw.bot_id) {
      authorId = personIdForBot(raw.bot_id);
      botIdsUsed.add(raw.bot_id);
      participantIds.add(authorId);
    } else {
      diagnostics.malformedSource(`Message has no "user" or "bot_id"`, ref);
    }

    const content = renderSlackText(raw.text ?? "", context, diagnostics, ref);

    if (content.trim().length === 0) {
      diagnostics.unsupported(
        `Message has no plain text content (may rely on rich "blocks"/"attachments" formatting not supported by this adapter)`,
        ref,
      );
    }

    let parentMessageId: string | undefined;
    if (raw.thread_ts && raw.thread_ts !== raw.ts) {
      if (tsSet.has(raw.thread_ts)) {
        parentMessageId = `slack:message:${raw.thread_ts}`;
      } else {
        diagnostics.missingReference(
          `Thread parent message (ts ${raw.thread_ts}) not found in this channel's exported range`,
          ref,
        );
      }
    }

    if (raw.files && raw.files.length > 0) {
      diagnostics.lossyConversion(
        `Message has ${raw.files.length} file attachment(s); the official Slack export only provides file metadata, not the file bytes, so they are preserved in metadata but not copied to output`,
        ref,
      );
    }

    const message: Message = {
      id: `slack:message:${raw.ts}`,
      type: "message",
      conversationId,
      authorId,
      parentMessageId,
      content,
      createdAt: normalizeTimestamp(tsToMillis(raw.ts)),
      source: { service: "slack", sourceId: raw.ts, sourcePath: `${channel.name}` },
      metadata: {
        slack: {
          subtype: raw.subtype,
          reactions: raw.reactions,
          files: raw.files,
        },
      },
    };

    return message;
  });

  const conversation: Conversation = {
    id: conversationId,
    type: "conversation",
    title: channel.name,
    participantIds: Array.from(participantIds),
    messageIds: messages.map((m) => m.id),
    source: { service: "slack", sourceId: channel.id },
    metadata: { slack: { channelName: channel.name } },
  };

  return { conversation, messages, botIdsUsed };
}
