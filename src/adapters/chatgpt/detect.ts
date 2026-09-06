import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { isPlausibleConversationsArray } from "./parse-source.js";

const CONVERSATIONS_FILE = "conversations.json";

export async function detectChatGpt(input: InputSource): Promise<DetectionResult> {
  const evidence: string[] = [];
  let confidence = 0;

  const hasConversationsFile = await input.hasFile(CONVERSATIONS_FILE);
  if (!hasConversationsFile) {
    return { adapter: "chatgpt", confidence: 0, evidence: ["conversations.json not found"] };
  }
  evidence.push("found conversations.json");
  confidence += 0.5;

  try {
    const text = await input.readText(CONVERSATIONS_FILE);
    const data = JSON.parse(text);
    if (isPlausibleConversationsArray(data)) {
      evidence.push("schema matched known ChatGPT export (mapping-based conversation tree)");
      confidence += 0.45;
    } else {
      evidence.push("conversations.json did not match expected ChatGPT structure");
    }
  } catch {
    evidence.push("conversations.json could not be parsed as JSON");
  }

  if (await input.hasFile("user.json")) {
    evidence.push("found user.json");
    confidence += 0.05;
  }

  return { adapter: "chatgpt", confidence: Math.min(confidence, 1), evidence };
}
