import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseGeminiGems } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseGeminiGems(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseGeminiGems", () => {
  it("parses the basic fixture into two Gem documents", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when no valid Gemini Gems export is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseGeminiGems(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces malformed-source and unsupported diagnostics for the edge-cases fixture", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
