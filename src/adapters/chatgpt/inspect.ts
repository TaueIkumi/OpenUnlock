import type { InputSource } from "../../core/input.js";
import type { InspectionResult } from "../../core/adapter.js";
import { detectChatGpt } from "./detect.js";
import { isPlausibleConversationsArray, type ChatGptConversation } from "./parse-source.js";

const CONVERSATIONS_FILE = "conversations.json";

function countUnsupportedContent(conversations: ChatGptConversation[]): number {
  let count = 0;
  for (const conversation of conversations) {
    for (const node of Object.values(conversation.mapping ?? {})) {
      const contentType = node.message?.content?.content_type;
      if (contentType && contentType !== "text") {
        count++;
      }
    }
  }
  return count;
}

export async function inspectChatGpt(input: InputSource): Promise<InspectionResult> {
  const detection = await detectChatGpt(input);
  const potentialIssues: string[] = [];

  if (!(await input.hasFile(CONVERSATIONS_FILE))) {
    return {
      source: "chatgpt",
      confidence: detection.confidence,
      contents: [],
      potentialIssues: ["conversations.json not found"],
    };
  }

  let conversations: ChatGptConversation[] = [];
  try {
    const data = JSON.parse(await input.readText(CONVERSATIONS_FILE));
    if (isPlausibleConversationsArray(data)) {
      conversations = data;
    } else {
      potentialIssues.push("conversations.json did not match the expected structure");
    }
  } catch {
    potentialIssues.push("conversations.json could not be parsed as JSON");
  }

  const messageCount = conversations.reduce(
    (sum, c) => sum + Object.values(c.mapping ?? {}).filter((n) => n.message?.id).length,
    0,
  );

  const unsupportedContentCount = countUnsupportedContent(conversations);
  if (unsupportedContentCount > 0) {
    potentialIssues.push(`${unsupportedContentCount} messages with non-text content`);
  }

  const emptyConversations = conversations.filter(
    (c) => Object.values(c.mapping ?? {}).filter((n) => n.message?.id).length === 0,
  ).length;
  if (emptyConversations > 0) {
    potentialIssues.push(`${emptyConversations} conversations with no messages`);
  }

  return {
    source: "chatgpt",
    confidence: detection.confidence,
    contents: [
      { label: "Conversations", count: conversations.length },
      { label: "Messages", count: messageCount },
    ],
    potentialIssues,
  };
}
