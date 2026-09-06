import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseDiscord } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseDiscord(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseDiscord", () => {
  it("parses the basic fixture into one person, two conversations, and three messages", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "person")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "conversation")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "message")).toHaveLength(3);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when messages/index.json is missing or invalid", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseDiscord(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces malformed-source diagnostics for the edge-cases fixture", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    // 1 dropped (no ID), 2 kept (one missing Timestamp)
    expect(entities.filter((e) => e.type === "message")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
