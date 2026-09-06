import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseLinear } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseLinear(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseLinear", () => {
  it("parses the basic fixture into a team, two issues, and an assignee", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "collection")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "person")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "relation")).toHaveLength(1);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when no valid Linear CSV is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseLinear(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces missing-reference and malformed-source diagnostics for the edge-cases fixture", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
