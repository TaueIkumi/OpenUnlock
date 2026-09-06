import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeChannelMessages, normalizeUser } from "./normalize.js";
import type { SlackChannel, SlackMessage } from "./parse-source.js";

const textContext = {
  displayNameByUserId: new Map([
    ["U001", "Alice"],
    ["U002", "Bob"],
  ]),
  channelNameById: new Map<string, string>(),
};

describe("normalizeUser", () => {
  it("prefers profile.display_name, falling back to real_name then name", () => {
    expect(normalizeUser({ id: "U001", profile: { display_name: "alice" } }).displayName).toBe(
      "alice",
    );
    expect(normalizeUser({ id: "U001", real_name: "Alice Doe" }).displayName).toBe("Alice Doe");
    expect(normalizeUser({ id: "U001", name: "alice" }).displayName).toBe("alice");
  });
});

describe("normalizeChannelMessages", () => {
  const channel: SlackChannel = { id: "C001", name: "general" };

  it("sorts messages by ts regardless of input order", () => {
    const raw: SlackMessage[] = [
      { type: "message", user: "U002", text: "second", ts: "200.0" },
      { type: "message", user: "U001", text: "first", ts: "100.0" },
    ];
    const diagnostics = new DiagnosticCollector();
    const { messages } = normalizeChannelMessages(channel, raw, textContext, diagnostics);
    expect(messages.map((m) => m.content)).toEqual(["first", "second"]);
  });

  it("resolves thread parent/child relationships", () => {
    const raw: SlackMessage[] = [
      { type: "message", user: "U001", text: "root", ts: "100.0", reply_count: 1 },
      { type: "message", user: "U002", text: "reply", ts: "150.0", thread_ts: "100.0" },
    ];
    const diagnostics = new DiagnosticCollector();
    const { messages } = normalizeChannelMessages(channel, raw, textContext, diagnostics);
    expect(messages[1]?.parentMessageId).toBe("slack:message:100.0");
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("reports a missing-reference diagnostic for a thread parent outside the export", () => {
    const raw: SlackMessage[] = [
      { type: "message", user: "U001", text: "reply", ts: "150.0", thread_ts: "999.0" },
    ];
    const diagnostics = new DiagnosticCollector();
    normalizeChannelMessages(channel, raw, textContext, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("skips messages without ts and reports malformed-source", () => {
    const raw: SlackMessage[] = [{ type: "message", user: "U001", text: "no ts" }];
    const diagnostics = new DiagnosticCollector();
    const { messages } = normalizeChannelMessages(channel, raw, textContext, diagnostics);
    expect(messages).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("creates a synthetic bot author and reports files as lossy", () => {
    const raw: SlackMessage[] = [
      {
        type: "message",
        bot_id: "B001",
        text: "deployed",
        ts: "100.0",
        files: [{ id: "F1", name: "a.png" }],
      },
    ];
    const diagnostics = new DiagnosticCollector();
    const { messages, botIdsUsed } = normalizeChannelMessages(channel, raw, textContext, diagnostics);
    expect(messages[0]?.authorId).toBe("slack:person:bot:B001");
    expect(botIdsUsed.has("B001")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });
});
