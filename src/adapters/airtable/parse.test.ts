import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseAirtable } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseAirtable(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseAirtable", () => {
  it("parses the basic fixture into one table and its rows", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "collection")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when no CSV with a header row is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseAirtable(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("parses a generic table with no Airtable-specific evidence just as well", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
