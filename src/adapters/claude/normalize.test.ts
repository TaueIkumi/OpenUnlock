import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeConversation } from "./normalize.js";
import type { ClaudeConversation } from "./parse-source.js";

describe("normalizeConversation", () => {
  it("normalizes a linear conversation, linking messages in order", () => {
    const raw: ClaudeConversation = {
      uuid: "conv-1",
      name: "Hello",
      created_at: "2024-03-01T10:00:00.000000+00:00",
      updated_at: "2024-03-01T10:05:00.000000+00:00",
      chat_messages: [
        { uuid: "m1", text: "hi", sender: "human", created_at: "2024-03-01T10:00:00.000000+00:00" },
        {
          uuid: "m2",
          content: [{ type: "text", text: "hello there" }],
          sender: "assistant",
          created_at: "2024-03-01T10:01:00.000000+00:00",
        },
      ],
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.conversation.title).toBe("Hello");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.parentMessageId).toBeUndefined();
    expect(result.messages[1]?.parentMessageId).toBe("claude:message:m1");
    expect(result.messages[1]?.content).toBe("hello there");
    expect(result.people.map((p) => p.displayName).sort()).toEqual(["Claude", "You"]);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("preserves unknown top-level fields in metadata", () => {
    const raw: ClaudeConversation = {
      uuid: "conv-2",
      name: "Future",
      chat_messages: [],
      future_field: "future-value",
    };
    const result = normalizeConversation(raw, 0, new DiagnosticCollector());
    expect(result.conversation.metadata?.claude).toMatchObject({
      extraFields: { future_field: "future-value" },
    });
  });

  it("reports unsupported for a message with only non-text content blocks", () => {
    const raw: ClaudeConversation = {
      uuid: "conv-3",
      chat_messages: [
        { uuid: "m1", content: [{ type: "tool_use" }], sender: "assistant", created_at: "2024-03-01T10:00:00Z" },
      ],
    };
    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);
    expect(result.messages[0]?.content).toBe("");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });

  it("reports lossy-conversion for attachments and malformed-source for a missing timestamp", () => {
    const raw: ClaudeConversation = {
      uuid: "conv-4",
      chat_messages: [
        {
          uuid: "m1",
          text: "see attached",
          sender: "human",
          attachments: [{ file_name: "a.txt" }],
        },
      ],
    };
    const diagnostics = new DiagnosticCollector();
    normalizeConversation(raw, 0, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });
});
