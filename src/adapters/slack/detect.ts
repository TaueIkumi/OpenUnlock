import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { isSlackChannelsFile, isSlackMessageArray, isSlackUsersFile } from "./parse-source.js";

const CHANNELS_FILE = "channels.json";
const USERS_FILE = "users.json";
const DAY_FILE_PATTERN = /^[^/]+\/\d{4}-\d{2}-\d{2}\.json$/;

export async function detectSlack(input: InputSource): Promise<DetectionResult> {
  const evidence: string[] = [];
  let confidence = 0;

  const hasChannels = await input.hasFile(CHANNELS_FILE);
  const hasUsers = await input.hasFile(USERS_FILE);

  if (!hasChannels && !hasUsers) {
    return {
      adapter: "slack",
      confidence: 0,
      evidence: ["channels.json and users.json not found"],
    };
  }

  if (hasChannels) {
    try {
      const data = JSON.parse(await input.readText(CHANNELS_FILE));
      if (isSlackChannelsFile(data)) {
        evidence.push("found channels.json with expected shape");
        confidence += 0.35;
      } else {
        evidence.push("channels.json did not match the expected Slack export structure");
      }
    } catch {
      evidence.push("channels.json could not be parsed as JSON");
    }
  } else {
    evidence.push("channels.json not found");
  }

  if (hasUsers) {
    try {
      const data = JSON.parse(await input.readText(USERS_FILE));
      if (isSlackUsersFile(data)) {
        evidence.push("found users.json with expected shape");
        confidence += 0.2;
      }
    } catch {
      evidence.push("users.json could not be parsed as JSON");
    }
  }

  const files = await input.listFiles();
  const dayFiles = files.filter((f) => DAY_FILE_PATTERN.test(f));
  if (dayFiles.length > 0) {
    evidence.push(`found ${dayFiles.length} per-day channel export file(s) (<channel>/YYYY-MM-DD.json)`);
    confidence += 0.3;

    try {
      const sample = JSON.parse(await input.readText(dayFiles[0]!));
      if (isSlackMessageArray(sample)) {
        evidence.push("sample day file matched expected Slack message array shape");
        confidence += 0.1;
      }
    } catch {
      evidence.push("sample day file could not be parsed as JSON");
    }
  } else {
    evidence.push("no per-day channel export files found");
  }

  return { adapter: "slack", confidence: Math.min(confidence, 1), evidence };
}
