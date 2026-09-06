import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { buildPageIndex, normalizeDatabase, normalizePage } from "./normalize.js";

describe("normalizePage", () => {
  const files = [
    "Project Plan 11111111111111111111111111111111.md",
    "Meeting Notes 22222222222222222222222222222222.md",
  ];
  const index = buildPageIndex(files);
  const allFiles = new Set(files);

  it("assigns a deterministic canonical id derived from the Notion id", () => {
    const diagnostics = new DiagnosticCollector();
    const { document } = normalizePage(
      "# Hello",
      "Project Plan 11111111111111111111111111111111.md",
      index,
      allFiles,
      diagnostics,
    );
    expect(document.id).toBe("notion:document:11111111111111111111111111111111");
    expect(document.title).toBe("Project Plan");
  });

  it("rewrites internal links to the openunlock://entity scheme", () => {
    const diagnostics = new DiagnosticCollector();
    const content =
      "See [Meeting Notes](Meeting%20Notes%2022222222222222222222222222222222.md) for details.";
    const { document } = normalizePage(
      content,
      "Project Plan 11111111111111111111111111111111.md",
      index,
      allFiles,
      diagnostics,
    );
    expect(document.content).toContain(
      "openunlock://entity/notion:document:22222222222222222222222222222222",
    );
    expect(document.relations).toEqual(["notion:document:22222222222222222222222222222222"]);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("reports a missing-reference diagnostic for links to pages outside the export", () => {
    const diagnostics = new DiagnosticCollector();
    const content = "See [Ghost](Ghost%20Page%2099999999999999999999999999999999.md).";
    normalizePage(
      content,
      "Project Plan 11111111111111111111111111111111.md",
      index,
      allFiles,
      diagnostics,
    );
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("detects attachment links and reports them as lossy", () => {
    const attachmentFiles = [
      "Photo Album 66666666666666666666666666666666.md",
      "Photo Album 66666666666666666666666666666666/beach.png",
    ];
    const attachmentIndex = buildPageIndex(attachmentFiles);
    const content = "![Beach](Photo%20Album%2066666666666666666666666666666666/beach.png)";
    const diagnostics = new DiagnosticCollector();
    const { document, attachments } = normalizePage(
      content,
      "Photo Album 66666666666666666666666666666666.md",
      attachmentIndex,
      new Set(attachmentFiles),
      diagnostics,
    );
    expect(attachments).toHaveLength(1);
    expect(document.attachments).toEqual([attachments[0]?.id]);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });
});

describe("normalizeDatabase", () => {
  it("creates a Collection and one Document per row", () => {
    const csv = 'Name,Status\n"Write adapter",Done\n"Write tests",In Progress\n';
    const diagnostics = new DiagnosticCollector();
    const { collection, rows } = normalizeDatabase(
      csv,
      "Tasks 55555555555555555555555555555555.csv",
      new Map(),
      diagnostics,
    );
    expect(collection.id).toBe("notion:collection:55555555555555555555555555555555");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe("Write adapter");
    expect(rows[0]?.parentId).toBe(collection.id);
    expect(rows[0]?.content).toContain("Status");
    expect(diagnostics.hasErrors()).toBe(false);
  });
});
