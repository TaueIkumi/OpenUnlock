import type { InputSource } from "../../core/input.js";
import type { DetectionResult } from "../../core/adapter.js";
import { isPlausibleClaudeConversationsArray } from "./parse-source.js";

const CONVERSATIONS_FILE = "conversations.json";

export async function detectClaude(input: InputSource): Promise<DetectionResult> {
  const evidence: string[] = [];
  let confidence = 0;

  const hasConversationsFile = await input.hasFile(CONVERSATIONS_FILE);
  if (!hasConversationsFile) {
    return { adapter: "claude", confidence: 0, evidence: ["conversations.json not found"] };
  }
  evidence.push("found conversations.json");
  confidence += 0.4;

  try {
    const text = await input.readText(CONVERSATIONS_FILE);
    const data = JSON.parse(text);
    if (isPlausibleClaudeConversationsArray(data)) {
      evidence.push('schema matched known Claude.ai export (flat "chat_messages" list, not a tree)');
      confidence += 0.5;
    } else {
      evidence.push("conversations.json did not match the expected Claude.ai structure");
    }
  } catch {
    evidence.push("conversations.json could not be parsed as JSON");
  }

  return { adapter: "claude", confidence: Math.min(confidence, 1), evidence };
}
