import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectSlack } from "./detect.js";
import { isSlackChannelsFile, isSlackMessageArray, isSlackUsersFile } from "./parse-source.js";

export async function inspectSlack(input: InputSource): Promise<InspectionResult> {
  const detection = await detectSlack(input);
  const potentialIssues: string[] = [];

  let channelCount = 0;
  let userCount = 0;

  if (await input.hasFile("channels.json")) {
    try {
      const data = JSON.parse(await input.readText("channels.json"));
      if (isSlackChannelsFile(data)) channelCount = data.length;
    } catch {
      potentialIssues.push("channels.json could not be parsed as JSON");
    }
  } else {
    potentialIssues.push("channels.json not found");
  }

  if (await input.hasFile("users.json")) {
    try {
      const data = JSON.parse(await input.readText("users.json"));
      if (isSlackUsersFile(data)) userCount = data.length;
    } catch {
      potentialIssues.push("users.json could not be parsed as JSON");
    }
  }

  const files = await input.listFiles();
  const dayFiles = files.filter((f) => /^[^/]+\/\d{4}-\d{2}-\d{2}\.json$/.test(f));

  let messageCount = 0;
  for (const file of dayFiles) {
    try {
      const data = JSON.parse(await input.readText(file));
      if (isSlackMessageArray(data)) {
        messageCount += data.length;
      }
    } catch {
      potentialIssues.push(`${file} could not be parsed as JSON`);
    }
  }

  return {
    source: "slack",
    confidence: detection.confidence,
    contents: [
      { label: "Channels", count: channelCount },
      { label: "Users", count: userCount },
      { label: "Messages", count: messageCount },
    ],
    potentialIssues,
  };
}
