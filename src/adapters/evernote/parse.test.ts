import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import { parseEvernote } from "./parse.js";
import { MalformedExportError } from "../../core/errors.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function collect(fixture: string) {
  const input = await openInputSource(path.join(fixturesDir, fixture));
  const diagnostics = new DiagnosticCollector();
  const attachmentBlobs = new AttachmentBlobStore();
  const entities = [];
  for await (const entity of parseEvernote(input, { diagnostics, attachmentBlobs })) {
    entities.push(entity);
  }
  return { entities, diagnostics, attachmentBlobs };
}

describe("parseEvernote", () => {
  it("parses the basic fixture into a collection, documents, people, and attachments", async () => {
    const { entities, diagnostics, attachmentBlobs } = await collect("basic");
    expect(entities.filter((e) => e.type === "collection")).toHaveLength(1);
    expect(entities.filter((e) => e.type === "document")).toHaveLength(2);
    expect(entities.filter((e) => e.type === "person")).toHaveLength(1);
    const attachments = entities.filter((e) => e.type === "attachment");
    expect(attachments).toHaveLength(1);
    expect(attachmentBlobs.get(attachments[0]!.id)).toBeInstanceOf(Buffer);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("throws MalformedExportError when no valid .enex export is found", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const diagnostics = new DiagnosticCollector();

    await expect(async () => {
      for await (const _entity of parseEvernote(input, { diagnostics })) {
        // drain
      }
    }).rejects.toThrow(MalformedExportError);
  });

  it("surfaces missing-reference and unsupported diagnostics for the edge-cases fixture", async () => {
    const { diagnostics } = await collect("edge-cases");
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
