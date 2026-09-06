import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import { parseGoogleKeep } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const attachmentBlobs = new AttachmentBlobStore();
  const entities = [];
  for await (const entity of parseGoogleKeep(input, { diagnostics, attachmentBlobs })) {
    entities.push(entity);
  }
  return { entities, diagnostics, attachmentBlobs };
}

describe("parseGoogleKeep", () => {
  it("parses the basic fixture into documents and a real copied attachment", async () => {
    const { entities, diagnostics, attachmentBlobs } = await collect("basic");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    const attachments = entities.filter((e) => e.type === "attachment");
    expect(attachments).toHaveLength(1);
    expect(attachmentBlobs.get(attachments[0]!.id)).toBeInstanceOf(Buffer);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when no valid Keep note is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseGoogleKeep(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces missing-reference, unsupported, and malformed-source diagnostics for the edge-cases fixture", async () => {
    const { entities, diagnostics } = await collect("edge-cases");
    expect(entities.filter((e) => e.type === "document")).toHaveLength(1);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
