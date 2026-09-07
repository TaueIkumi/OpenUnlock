import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeConversation } from "./normalize.js";
import type { ChatGptConversation } from "./parse-source.js";

describe("normalizeConversation", () => {
  it("normalizes a basic linear conversation", () => {
    const raw: ChatGptConversation = {
      title: "Hello",
      create_time: 1700000000,
      update_time: 1700000060,
      conversation_id: "conv-1",
      current_node: "n2",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "user" },
            create_time: 1700000000,
            content: { content_type: "text", parts: ["hi"] },
          },
          parent: null,
          children: ["n2"],
        },
        n2: {
          id: "n2",
          message: {
            id: "m2",
            author: { role: "assistant" },
            create_time: 1700000030,
            content: { content_type: "text", parts: ["hello there"] },
          },
          parent: "n1",
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.conversation.id).toBe("chatgpt:conversation:conv-1");
    expect(result.conversation.messageIds).toEqual(["chatgpt:message:m1", "chatgpt:message:m2"]);
    expect(result.messages[1]?.parentMessageId).toBe("chatgpt:message:m1");
    expect(result.messages[0]?.content).toBe("hi");
    expect(result.people.map((p) => p.id)).toEqual(
      expect.arrayContaining(["chatgpt:person:user", "chatgpt:person:assistant"]),
    );
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("preserves branching structure via parentMessageId", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-2",
      mapping: {
        q: {
          id: "q",
          message: {
            id: "mq",
            author: { role: "user" },
            create_time: 100,
            content: { content_type: "text", parts: ["question"] },
          },
          parent: null,
          children: ["a", "b"],
        },
        a: {
          id: "a",
          message: {
            id: "ma",
            author: { role: "assistant" },
            create_time: 101,
            content: { content_type: "text", parts: ["answer a"] },
          },
          parent: "q",
          children: [],
        },
        b: {
          id: "b",
          message: {
            id: "mb",
            author: { role: "assistant" },
            create_time: 102,
            content: { content_type: "text", parts: ["answer b"] },
          },
          parent: "q",
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    const branchMessages = result.messages.filter((m) => m.parentMessageId === "chatgpt:message:mq");
    expect(branchMessages).toHaveLength(2);
    expect(result.conversation.metadata?.chatgpt).toMatchObject({ branchCount: 3 });
  });

  it("reports unsupported content types as diagnostics instead of dropping the message", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-3",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "user" },
            create_time: 100,
            content: { content_type: "multimodal_text", parts: [{ image: "file-1" }] },
          },
          parent: null,
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe("");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });

  it("reports missing create_time as a malformed-source diagnostic", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-4",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "user" },
            content: { content_type: "text", parts: ["no timestamp"] },
          },
          parent: null,
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    normalizeConversation(raw, 0, diagnostics);

    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("renders a reasoning_recap message's content as plain text", () => {
    // Found by running this adapter against a real export from a reasoning
    // model (o1/o3-style extended thinking) — not documented by OpenAI.
    const raw: ChatGptConversation = {
      conversation_id: "conv-6",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "assistant" },
            create_time: 100,
            content: { content_type: "reasoning_recap", content: "Thought for 12 seconds" },
          },
          parent: null,
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.messages[0]?.content).toBe("Thought for 12 seconds");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(false);
  });

  it("renders a thoughts message by joining each step's content or summary", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-7",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "assistant" },
            create_time: 100,
            content: {
              content_type: "thoughts",
              thoughts: [
                { summary: "Considering the request", content: "", finished: true },
                { summary: "Drafting a reply", content: "Here is the full reasoning text.", finished: true },
              ],
            },
          },
          parent: null,
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.messages[0]?.content).toBe(
      "Considering the request\n\nHere is the full reasoning text.",
    );
    // The raw shape is kept as a safety net even though it's rendered.
    expect(result.messages[0]?.metadata?.chatgpt).toHaveProperty("rawContent");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(false);
  });

  it("reports thoughts with no readable summary or content as unsupported", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-8",
      mapping: {
        n1: {
          id: "n1",
          message: {
            id: "m1",
            author: { role: "assistant" },
            create_time: 100,
            content: { content_type: "thoughts", thoughts: [{ finished: true }] },
          },
          parent: null,
          children: [],
        },
      },
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.messages[0]?.content).toBe("");
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });

  it("preserves unknown top-level fields in metadata", () => {
    const raw: ChatGptConversation = {
      conversation_id: "conv-5",
      future_field: "vendor-added-this",
      mapping: {},
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeConversation(raw, 0, diagnostics);

    expect(result.conversation.metadata?.chatgpt).toMatchObject({
      extraFields: { future_field: "vendor-added-this" },
    });
  });
});
