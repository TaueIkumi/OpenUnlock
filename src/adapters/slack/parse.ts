import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import {
  isSlackChannelsFile,
  isSlackMessageArray,
  isSlackUsersFile,
  type SlackChannel,
  type SlackMessage,
  type SlackUser,
} from "./parse-source.js";
import { normalizeChannelMessages, normalizeUser, syntheticBotPerson } from "./normalize.js";
import type { SlackTextContext } from "./render-text.js";

const CHANNELS_FILE = "channels.json";
const USERS_FILE = "users.json";

async function loadJsonArray<T>(
  input: InputSource,
  file: string,
  guard: (data: unknown) => data is T[],
  label: string,
): Promise<T[]> {
  if (!(await input.hasFile(file))) return [];
  let data: unknown;
  try {
    data = JSON.parse(await input.readText(file));
  } catch {
    throw new MalformedExportError(`Failed to parse ${file}: not valid JSON.`);
  }
  if (!guard(data)) {
    throw new MalformedExportError(`${file} does not match the expected ${label} shape.`);
  }
  return data;
}

export async function* parseSlack(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const channels = await loadJsonArray<SlackChannel>(
    input,
    CHANNELS_FILE,
    isSlackChannelsFile,
    "Slack channels.json",
  );
  const users = await loadJsonArray<SlackUser>(input, USERS_FILE, isSlackUsersFile, "Slack users.json");

  if (channels.length === 0) {
    throw new MalformedExportError(
      `No channels found in ${CHANNELS_FILE}. This export may be corrupted or empty.`,
    );
  }

  for (const user of users) {
    yield normalizeUser(user);
  }

  const textContext: SlackTextContext = {
    displayNameByUserId: new Map(
      users.map((u) => [u.id, u.profile?.display_name || u.real_name || u.name || u.id]),
    ),
    channelNameById: new Map(channels.map((c) => [c.id, c.name])),
  };

  const allFiles = await input.listFiles();
  const emittedBotIds = new Set<string>();

  for (const channel of channels) {
    const dayFiles = allFiles
      .filter((f) => f.startsWith(`${channel.name}/`) && /\.json$/.test(f))
      .sort();

    if (dayFiles.length === 0) {
      context.diagnostics.warning(
        `No message files found for channel "${channel.name}"`,
        `slack:conversation:${channel.id}`,
      );
    }

    const rawMessages: SlackMessage[] = [];
    for (const dayFile of dayFiles) {
      let data: unknown;
      try {
        data = JSON.parse(await input.readText(dayFile));
      } catch {
        context.diagnostics.malformedSource(`Failed to parse ${dayFile}: not valid JSON`, dayFile);
        continue;
      }
      if (!isSlackMessageArray(data)) {
        context.diagnostics.malformedSource(
          `${dayFile} does not match the expected Slack message array shape`,
          dayFile,
        );
        continue;
      }
      rawMessages.push(...data);
    }

    const { conversation, messages, botIdsUsed } = normalizeChannelMessages(
      channel,
      rawMessages,
      textContext,
      context.diagnostics,
    );

    for (const botId of botIdsUsed) {
      if (!emittedBotIds.has(botId)) {
        emittedBotIds.add(botId);
        yield syntheticBotPerson(botId);
      }
    }

    yield conversation;
    for (const message of messages) {
      yield message;
    }
  }
}
