import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { CHANNEL_DIR_PATTERN, isDiscordChannelIndex, isDiscordMessageArray } from "./parse-source.js";

const INDEX_FILE = "messages/index.json";

export async function detectDiscord(input: InputSource): Promise<DetectionResult> {
  const evidence: string[] = [];
  let confidence = 0;

  const hasIndex = await input.hasFile(INDEX_FILE);
  if (!hasIndex) {
    return { adapter: "discord", confidence: 0, evidence: ["messages/index.json not found"] };
  }

  try {
    const data = JSON.parse(await input.readText(INDEX_FILE));
    if (isDiscordChannelIndex(data)) {
      evidence.push("found messages/index.json with expected shape (channel id -> label)");
      confidence += 0.4;
    } else {
      evidence.push("messages/index.json did not match the expected structure");
    }
  } catch {
    evidence.push("messages/index.json could not be parsed as JSON");
  }

  const files = await input.listFiles();
  const channelMessageFiles = files.filter((f) => CHANNEL_DIR_PATTERN.test(f));

  if (channelMessageFiles.length === 0) {
    evidence.push("no messages/c<id>/messages.json files found");
    return { adapter: "discord", confidence: Math.min(confidence, 1), evidence };
  }

  evidence.push(`found ${channelMessageFiles.length} channel message export file(s)`);
  confidence += 0.3;

  try {
    const sample = JSON.parse(await input.readText(channelMessageFiles[0]!));
    if (isDiscordMessageArray(sample)) {
      evidence.push('sample channel file matched expected shape ("ID"/"Timestamp"/"Contents")');
      confidence += 0.3;
    }
  } catch {
    evidence.push("sample channel file could not be parsed as JSON");
  }

  return { adapter: "discord", confidence: Math.min(confidence, 1), evidence };
}
