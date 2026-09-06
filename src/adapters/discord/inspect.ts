import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectDiscord } from "./detect.js";
import { CHANNEL_DIR_PATTERN, isDiscordMessageArray } from "./parse-source.js";

export async function inspectDiscord(input: InputSource): Promise<InspectionResult> {
  const detection = await detectDiscord(input);
  const potentialIssues: string[] = [];

  const files = await input.listFiles();
  const channelMessageFiles = files.filter((f) => CHANNEL_DIR_PATTERN.test(f));

  if (channelMessageFiles.length === 0) {
    return {
      source: "discord",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["no messages/c<id>/messages.json files were found"],
    };
  }

  let messageCount = 0;
  let malformedChannels = 0;
  let attachmentMessageCount = 0;

  for (const file of channelMessageFiles) {
    try {
      const data = JSON.parse(await input.readText(file));
      if (!isDiscordMessageArray(data)) {
        malformedChannels++;
        continue;
      }
      messageCount += data.length;
      attachmentMessageCount += data.filter((m) => (m.Attachments ?? "").trim().length > 0).length;
    } catch {
      malformedChannels++;
    }
  }

  if (malformedChannels > 0) {
    potentialIssues.push(`${malformedChannels} channel file(s) could not be parsed`);
  }
  if (attachmentMessageCount > 0) {
    potentialIssues.push(`${attachmentMessageCount} message(s) reference attachments that will not be copied`);
  }

  return {
    source: "discord",
    confidence: detection.confidence,
    contents: [
      { label: "Channels", count: channelMessageFiles.length },
      { label: "Messages", count: messageCount },
    ],
    potentialIssues,
  };
}
