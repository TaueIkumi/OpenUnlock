import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Conversation, Message, Person } from "../../core/canonical/types.js";
import { normalizeDiscordTimestamp } from "./parse-source.js";
import type { DiscordChannel, DiscordMessage, DiscordUser } from "./parse-source.js";

export const SELF_PERSON_ID = "discord:person:self";

/**
 * The export only ever contains the account owner's own messages (see
 * parse-source.ts), so there's exactly one author across the whole export.
 */
export function buildSelfPerson(user: DiscordUser | undefined): Person {
  return {
    id: SELF_PERSON_ID,
    type: "person",
    displayName: user?.username ?? "You",
    email: user?.email,
    source: { service: "discord", sourceId: user?.id },
    metadata: { discord: { isAccountOwner: true } },
  };
}

export function normalizeChannel(
  channelId: string,
  label: string,
  channel: DiscordChannel,
  rawMessages: DiscordMessage[],
  diagnostics: DiagnosticCollector,
): { conversation: Conversation; messages: Message[] } {
  const conversationId = `discord:conversation:${channelId}`;

  const withId = rawMessages.filter((m): m is DiscordMessage & { ID: string } => {
    if (!m.ID) {
      diagnostics.malformedSource(`Message is missing "ID" and was skipped`, conversationId);
      return false;
    }
    return true;
  });

  const messages: Message[] = withId.map((raw) => {
    const ref = `${conversationId}#${raw.ID}`;

    if (!raw.Timestamp) {
      diagnostics.malformedSource(`Message is missing "Timestamp"`, ref);
    }

    const attachmentUrls = (raw.Attachments ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (attachmentUrls.length > 0) {
      diagnostics.lossyConversion(
        `Message has ${attachmentUrls.length} attachment(s); Discord's export only provides ` +
          `expiring CDN URLs, not the file bytes, so they are preserved in metadata but not copied`,
        ref,
      );
    }

    return {
      id: `discord:message:${raw.ID}`,
      type: "message",
      conversationId,
      authorId: SELF_PERSON_ID,
      content: raw.Contents ?? "",
      createdAt: normalizeDiscordTimestamp(raw.Timestamp),
      source: { service: "discord", sourceId: raw.ID, sourcePath: `messages/c${channelId}` },
      metadata: {
        discord: {
          attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
        },
      },
    };
  });

  messages.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id));

  const conversation: Conversation = {
    id: conversationId,
    type: "conversation",
    title: label,
    participantIds: [SELF_PERSON_ID],
    messageIds: messages.map((m) => m.id),
    source: { service: "discord", sourceId: channelId },
    metadata: {
      discord: {
        channelType: channel.type,
        guildId: channel.guild?.id,
        guildName: channel.guild?.name,
      },
    },
  };

  return { conversation, messages };
}
