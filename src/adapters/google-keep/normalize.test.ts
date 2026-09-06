import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import { normalizeNote } from "./normalize.js";
import type { GoogleKeepNote } from "./parse-source.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("normalizeNote", () => {
  it("renders plain textContent as-is", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const note: GoogleKeepNote = {
      title: "Grocery list",
      textContent: "Milk\nEggs",
      isTrashed: false,
      isPinned: true,
      isArchived: false,
      createdTimestampUsec: 1704060000000000,
    };
    const result = await normalizeNote("Grocery list.json", note, input, new DiagnosticCollector());
    expect(result.document.content).toBe("Milk\nEggs");
    expect(result.document.title).toBe("Grocery list");
    expect(result.document.metadata?.googleKeep).toMatchObject({ isPinned: true });
  });

  it("renders listContent as a markdown checklist", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const note: GoogleKeepNote = {
      title: "Trip",
      listContent: [
        { text: "Passport", isChecked: true },
        { text: "Sunscreen", isChecked: false },
      ],
      isTrashed: false,
      isPinned: false,
      isArchived: false,
    };
    const result = await normalizeNote("Trip.json", note, input, new DiagnosticCollector());
    expect(result.document.content).toBe("- [x] Passport\n- [ ] Sunscreen");
  });

  it("copies real attachment bytes and links them to the document", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const note: GoogleKeepNote = {
      title: "Trip packing",
      isTrashed: false,
      isPinned: false,
      isArchived: false,
      createdTimestampUsec: 1704150000000000,
      attachments: [{ filePath: "photo.jpg", mimetype: "image/jpeg" }],
    };
    const blobs = new AttachmentBlobStore();
    const diagnostics = new DiagnosticCollector();
    const result = await normalizeNote("Trip packing.json", note, input, diagnostics, blobs);

    expect(result.attachments).toHaveLength(1);
    const attachment = result.attachments[0]!;
    expect(attachment.filename).toBe("photo.jpg");
    expect(attachment.mediaType).toBe("image/jpeg");
    expect(blobs.get(attachment.id)).toBeInstanceOf(Buffer);
    expect(result.document.attachments).toEqual([attachment.id]);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("reports missing-reference for an attachment file that isn't in the export", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const note: GoogleKeepNote = {
      title: "Ghost",
      isTrashed: false,
      isPinned: false,
      isArchived: false,
      attachments: [{ filePath: "does-not-exist.png" }],
    };
    const diagnostics = new DiagnosticCollector();
    const result = await normalizeNote("Ghost.json", note, input, diagnostics);
    expect(result.attachments).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("reports malformed-source when both timestamps are missing", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const note: GoogleKeepNote = {
      title: "No time",
      isTrashed: false,
      isPinned: false,
      isArchived: false,
    };
    const diagnostics = new DiagnosticCollector();
    await normalizeNote("No time.json", note, input, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });
});
