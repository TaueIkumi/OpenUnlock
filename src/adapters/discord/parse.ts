import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import {
  CHANNEL_DIR_PATTERN,
  isDiscordChannelIndex,
  isDiscordMessageArray,
  type DiscordChannel,
  type DiscordUser,
} from "./parse-source.js";
import { buildSelfPerson, normalizeChannel } from "./normalize.js";

const INDEX_FILE = "messages/index.json";
const USER_FILE = "account/user.json";

export async function* parseDiscord(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  if (!(await input.hasFile(INDEX_FILE))) {
    throw new MalformedExportError(`${INDEX_FILE} not found. This does not look like a Discord export.`);
  }

  let index: unknown;
  try {
    index = JSON.parse(await input.readText(INDEX_FILE));
  } catch {
    throw new MalformedExportError(`Failed to parse ${INDEX_FILE}: not valid JSON.`);
  }

  if (!isDiscordChannelIndex(index)) {
    throw new MalformedExportError(
      `${INDEX_FILE} does not match the expected structure (an object mapping channel id to a display label).`,
    );
  }

  let user: DiscordUser | undefined;
  if (await input.hasFile(USER_FILE)) {
    try {
      user = JSON.parse(await input.readText(USER_FILE));
    } catch {
      context.diagnostics.malformedSource(`${USER_FILE} is not valid JSON`, USER_FILE);
    }
  }

  const files = await input.listFiles();
  const channelMessageFiles = files.filter((f) => CHANNEL_DIR_PATTERN.test(f)).sort();

  if (channelMessageFiles.length === 0) {
    throw new MalformedExportError("No messages/c<id>/messages.json files were found.");
  }

  yield buildSelfPerson(user);

  for (const messagesPath of channelMessageFiles) {
    const channelId = messagesPath.match(CHANNEL_DIR_PATTERN)![1]!;
    const channelJsonPath = `messages/c${channelId}/channel.json`;

    let channel: DiscordChannel = {};
    if (await input.hasFile(channelJsonPath)) {
      try {
        channel = JSON.parse(await input.readText(channelJsonPath));
      } catch {
        context.diagnostics.malformedSource(`${channelJsonPath} is not valid JSON`, channelId);
      }
    }

    let rawMessages: unknown;
    try {
      rawMessages = JSON.parse(await input.readText(messagesPath));
    } catch {
      context.diagnostics.malformedSource(`${messagesPath} is not valid JSON; channel skipped`, channelId);
      continue;
    }

    if (!isDiscordMessageArray(rawMessages)) {
      context.diagnostics.malformedSource(
        `${messagesPath} does not match the expected message array shape; channel skipped`,
        channelId,
      );
      continue;
    }

    const label = index[channelId] ?? channel.name ?? channelId;
    const normalized = normalizeChannel(channelId, label, channel, rawMessages, context.diagnostics);

    yield normalized.conversation;
    for (const message of normalized.messages) {
      yield message;
    }
  }
}
