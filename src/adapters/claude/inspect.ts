import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectClaude } from "./detect.js";
import { isPlausibleClaudeConversationsArray, type ClaudeConversation } from "./parse-source.js";

const CONVERSATIONS_FILE = "conversations.json";

export async function inspectClaude(input: InputSource): Promise<InspectionResult> {
  const detection = await detectClaude(input);
  const potentialIssues: string[] = [];

  if (!(await input.hasFile(CONVERSATIONS_FILE))) {
    return {
      source: "claude",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["conversations.json not found"],
    };
  }

  let conversations: ClaudeConversation[] = [];
  try {
    const data = JSON.parse(await input.readText(CONVERSATIONS_FILE));
    if (isPlausibleClaudeConversationsArray(data)) {
      conversations = data;
    } else {
      potentialIssues.push("conversations.json did not match the expected structure");
    }
  } catch {
    potentialIssues.push("conversations.json could not be parsed as JSON");
  }

  const messageCount = conversations.reduce((sum, c) => sum + (c.chat_messages?.length ?? 0), 0);
  const attachmentMessageCount = conversations.reduce(
    (sum, c) =>
      sum +
      (c.chat_messages ?? []).filter((m) => (m.attachments?.length ?? 0) + (m.files?.length ?? 0) > 0)
        .length,
    0,
  );
  const emptyConversations = conversations.filter((c) => (c.chat_messages?.length ?? 0) === 0).length;

  if (attachmentMessageCount > 0) {
    potentialIssues.push(`${attachmentMessageCount} messages reference attachments that will not be copied`);
  }
  if (emptyConversations > 0) {
    potentialIssues.push(`${emptyConversations} conversations with no messages`);
  }

  return {
    source: "claude",
    confidence: detection.confidence,
    contents: [
      { label: "Conversations", count: conversations.length },
      { label: "Messages", count: messageCount },
    ],
    potentialIssues,
  };
}
