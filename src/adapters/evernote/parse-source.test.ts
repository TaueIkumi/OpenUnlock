import { describe, expect, it } from "vitest";
import { normalizeEvernoteTimestamp, parseEvernoteExport } from "./parse-source.js";

describe("normalizeEvernoteTimestamp", () => {
  it("converts Evernote's compact timestamp format to ISO 8601", () => {
    expect(normalizeEvernoteTimestamp("20240110T090000Z")).toBe("2024-01-10T09:00:00.000Z");
  });

  it("returns undefined for missing or malformed values", () => {
    expect(normalizeEvernoteTimestamp(undefined)).toBeUndefined();
    expect(normalizeEvernoteTimestamp("not-a-timestamp")).toBeUndefined();
    expect(normalizeEvernoteTimestamp("2024-01-10T09:00:00Z")).toBeUndefined();
  });
});

describe("parseEvernoteExport", () => {
  it("parses a well-formed export", () => {
    const xml = `<?xml version="1.0"?>
<en-export export-date="20240115T120000Z">
<note>
<title>Hello</title>
<content><![CDATA[<en-note>World</en-note>]]></content>
<created>20240110T090000Z</created>
<tag>a</tag>
<tag>b</tag>
</note>
</en-export>`;

    const result = parseEvernoteExport(xml);
    expect(result?.exportDate).toBe("20240115T120000Z");
    expect(result?.notes).toHaveLength(1);
    expect(result?.notes[0]?.title).toBe("Hello");
    expect(result?.notes[0]?.contentHtml).toBe("World");
    expect(result?.notes[0]?.tags).toEqual(["a", "b"]);
  });

  it("returns undefined for non-Evernote XML", () => {
    expect(parseEvernoteExport("<not-en-export/>")).toBeUndefined();
    expect(parseEvernoteExport("plain text, not xml")).toBeUndefined();
  });

  it("decodes base64 resource data", () => {
    const xml = `<en-export>
<note>
<title>With resource</title>
<content><![CDATA[<en-note>Body</en-note>]]></content>
<created>20240110T090000Z</created>
<resource>
<data encoding="base64">aGVsbG8=</data>
<mime>text/plain</mime>
<resource-attributes><file-name>hi.txt</file-name></resource-attributes>
</resource>
</note>
</en-export>`;

    const result = parseEvernoteExport(xml);
    const resource = result?.notes[0]?.resources[0];
    expect(resource?.data?.toString("utf8")).toBe("hello");
    expect(resource?.fileName).toBe("hi.txt");
    expect(resource?.mime).toBe("text/plain");
  });
});
