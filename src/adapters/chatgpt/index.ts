import type { SourceAdapter } from "../../core/adapter.js";
import { detectChatGpt } from "./detect.js";
import { inspectChatGpt } from "./inspect.js";
import { parseChatGpt } from "./parse.js";

export const chatGptAdapter: SourceAdapter = {
  id: "chatgpt",
  displayName: "ChatGPT",
  detect: detectChatGpt,
  inspect: inspectChatGpt,
  parse: parseChatGpt,
};
