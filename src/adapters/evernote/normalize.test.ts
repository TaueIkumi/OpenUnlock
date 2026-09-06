import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import { normalizeExport } from "./normalize.js";
import { parseEvernoteExport } from "./parse-source.js";

function parse(xml: string) {
  const parsed = parseEvernoteExport(xml);
  if (!parsed) throw new Error("fixture XML did not parse");
  return parsed;
}

describe("normalizeExport", () => {
  it("derives the notebook title from the file name", () => {
    const raw = parse(`<en-export><note><title>N</title><content><![CDATA[<en-note>x</en-note>]]></content><created>20240110T090000Z</created></note></en-export>`);
    const result = normalizeExport("My Notebook.enex", raw, new DiagnosticCollector());
    expect(result.collection.title).toBe("My Notebook");
  });

  it("rewrites <en-media> to an openunlock entity link and registers the attachment", () => {
    const raw = parse(`<en-export>
<note>
<title>Note</title>
<content><![CDATA[<en-note><en-media hash="5d41402abc4b2a76b9719d911017c592" type="text/plain"/></en-note>]]></content>
<created>20240110T090000Z</created>
<resource>
<data encoding="base64">aGVsbG8=</data>
<mime>text/plain</mime>
<resource-attributes><file-name>hi.txt</file-name></resource-attributes>
</resource>
</note>
</en-export>`);
    // md5("hello") = 5d41402abc4b2a76b9719d911017c592
    const blobs = new AttachmentBlobStore();
    const diagnostics = new DiagnosticCollector();
    const result = normalizeExport("Notes.enex", raw, diagnostics, blobs);

    expect(result.attachments).toHaveLength(1);
    const attachment = result.attachments[0]!;
    expect(attachment.filename).toBe("hi.txt");
    expect(attachment.size).toBe(5);
    expect(blobs.get(attachment.id)?.toString("utf8")).toBe("hello");
    expect(result.documents[0]?.content).toContain(`openunlock://entity/${attachment.id}`);
    expect(result.documents[0]?.attachments).toEqual([attachment.id]);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("reports a missing-reference diagnostic for a dangling <en-media> hash", () => {
    const raw = parse(`<en-export>
<note>
<title>Note</title>
<content><![CDATA[<en-note><en-media hash="00000000000000000000000000000000" type="image/png"/></en-note>]]></content>
<created>20240110T090000Z</created>
</note>
</en-export>`);
    const diagnostics = new DiagnosticCollector();
    const result = normalizeExport("Notes.enex", raw, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
    expect(result.documents[0]?.content).toContain("<en-media");
  });

  it("reports unsupported for a resource with no data payload", () => {
    const raw = parse(`<en-export>
<note>
<title>Note</title>
<content><![CDATA[<en-note>Body</en-note>]]></content>
<created>20240110T090000Z</created>
<resource><mime>application/octet-stream</mime></resource>
</note>
</en-export>`);
    const diagnostics = new DiagnosticCollector();
    const result = normalizeExport("Notes.enex", raw, diagnostics);
    expect(result.attachments).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
  });

  it("creates a Person for the note author and links them via metadata", () => {
    const raw = parse(`<en-export>
<note>
<title>Note</title>
<content><![CDATA[<en-note>Body</en-note>]]></content>
<created>20240110T090000Z</created>
<note-attributes><author>Alice Doe</author></note-attributes>
</note>
</en-export>`);
    const result = normalizeExport("Notes.enex", raw, new DiagnosticCollector());
    expect(result.people).toHaveLength(1);
    expect(result.people[0]?.displayName).toBe("Alice Doe");
    expect(result.documents[0]?.metadata?.evernote).toMatchObject({ author: "Alice Doe" });
  });

  it("reports malformed-source for a note missing <created>", () => {
    const raw = parse(`<en-export><note><title>N</title><content><![CDATA[<en-note>x</en-note>]]></content></note></en-export>`);
    const diagnostics = new DiagnosticCollector();
    normalizeExport("Notes.enex", raw, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });
});
