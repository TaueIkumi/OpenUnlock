import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseSlack } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseSlack(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseSlack", () => {
  it("parses the basic fixture into people, conversation and messages", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "person")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "conversation")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "message")).toHaveLength(2);
    expect(diagnostics.hasErrors()).toBe(false);

    const messages = entities.filter((e) => e.type === "message");
    expect(messages[0]?.content).toBe("Hey @bob, did you see the new deploy?");
    expect(messages[1]?.content).toBe("Yes, looks good! Check #general for updates.");
  });

  it("preserves thread structure across a channel's day files", async () => {
    const { entities } = await collect("threads");
    const messages = entities.filter((e) => e.type === "message");
    expect(messages).toHaveLength(3);
    expect(messages[1]?.parentMessageId).toBe(messages[0]?.id);
    expect(messages[2]?.parentMessageId).toBe(messages[0]?.id);
  });

  it("merges and sorts messages spread across multiple day files", async () => {
    const { entities } = await collect("multi-user");
    const conversation = entities.find((e) => e.type === "conversation");
    expect(conversation?.messageIds).toHaveLength(3);
  });

  it("skips unparsable day files but keeps messages with no author (reported, not dropped)", async () => {
    const { entities, diagnostics } = await collect("malformed");
    const messages = entities.filter((e) => e.type === "message");
    // day 1 has two messages (one with no user/bot_id); day 2 is invalid JSON and is skipped entirely.
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.authorId === undefined)).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("creates a synthetic bot person and surfaces file attachments as lossy", async () => {
    const { entities, diagnostics } = await collect("attachments");
    expect(entities.some((e) => e.id === "slack:person:bot:B001")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });

  it("throws MalformedExportError when channels.json is missing entirely", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic", "general"));
    const diagnostics = new DiagnosticCollector();
    await expect(async () => {
      for await (const _entity of parseSlack(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });
});
