import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseClaude } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseClaude(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseClaude", () => {
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
      for await (const _entity of parseClaude(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces diagnostics for the edge-cases fixture without dropping conversations", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    expect(entities.filter((e) => e.type === "conversation")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "warning")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
