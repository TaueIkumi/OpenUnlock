import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { parseNotion } from "./parse.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const entities = [];
  for await (const entity of parseNotion(input, { diagnostics })) {
    entities.push(entity);
  }
  return { entities, diagnostics };
}

describe("parseNotion", () => {
  it("parses two linked pages", async () => {
    const { entities, diagnostics } = await collect("basic");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("resolves parentId from directory nesting", async () => {
    const { entities } = await collect("nested-pages");
    const documents = entities.filter((e) => e.type === "document");
    expect(documents).toHaveLength(2);
    const child = documents.find((d) => d.title === "Onboarding");
    const parent = documents.find((d) => d.title === "Handbook");
    expect(child?.parentId).toBe(parent?.id);
  });

  it("parses a database CSV into a Collection with row Documents", async () => {
    const { entities } = await collect("database");
    expect(entities.filter((e) => e.type === "collection")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
  });

  it("surfaces missing-reference diagnostics without dropping the page", async () => {
    const { entities, diagnostics } = await collect("malformed");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(1);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("creates Attachment entities and reports them as lossy", async () => {
    const { entities, diagnostics } = await collect("attachments");
    expect(entities.filter((e) => e.type === "attachment")).toHaveLength(1);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });
});
