import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseChatGpt } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseChatGpt(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseChatGpt", () => {
  it("parses the basic fixture into people, conversation, and messages", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "conversation")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "message")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "person")).toHaveLength(2);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError for invalid JSON", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseChatGpt(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("preserves both branches of the branching-conversation fixture", async () => {
    const { entities } = await collect("branching-conversation");
    expect(entities.filter((e) => e.type === "message")).toHaveLength(3);
  });

  it("surfaces unsupported content diagnostics for the attachments fixture", async () => {
    const { entities, diagnostics } = await collect("attachments");
    expect(entities.filter((e) => e.type === "message")).toHaveLength(1);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });

  it("renders thoughts/reasoning_recap messages as readable text (reasoning fixture)", async () => {
    // Regression coverage for a real-world gap: a reasoning-model export
    // had ~half its messages as "thoughts"/"reasoning_recap", which used
    // to be dropped to empty content with an "unsupported" diagnostic.
    const { entities, diagnostics } = await collect("reasoning");
    const messages = entities.filter((e) => e.type === "message");
    expect(messages).toHaveLength(4);

    const thoughtsMessage = messages.find((m) => "content" in m && m.content.includes("global counter"));
    expect(thoughtsMessage).toBeDefined();

    const recapMessage = messages.find((m) => "content" in m && m.content === "Thought for 8 seconds");
    expect(recapMessage).toBeDefined();

    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(false);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("parses the unknown-fields fixture without dropping vendor data", async () => {
    const { entities } = await collect("unknown-fields");
    const conversation = entities.find((e) => e.type === "conversation");
    expect(conversation?.metadata?.chatgpt).toMatchObject({
      extraFields: expect.objectContaining({ conversation_template_id: "future-template" }),
    });
  });
});
