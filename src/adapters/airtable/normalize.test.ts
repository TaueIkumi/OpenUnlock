import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeTable } from "./normalize.js";
import { parseCsvTable } from "../../utils/csv.js";

describe("normalizeTable", () => {
  it("derives the table title from the filename, stripping a Grid view suffix", () => {
    const table = parseCsvTable("Name,Status\nA,Done\n");
    const result = normalizeTable("Tasks-Grid view.csv", table, new DiagnosticCollector());
    expect(result.collection.title).toBe("Tasks");
  });

  it("uses the first column as the row title and renders other fields as a bullet list", () => {
    const table = parseCsvTable("Name,Status,Notes\nDesign homepage,In progress,Review needed\n");
    const result = normalizeTable("Tasks.csv", table, new DiagnosticCollector());
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.title).toBe("Design homepage");
    expect(result.documents[0]?.content).toContain("- **Status**: In progress");
    expect(result.documents[0]?.content).toContain("- **Notes**: Review needed");
    expect(result.documents[0]?.content).not.toContain("Design homepage");
  });

  it("reports lossy-conversion for a cell containing an Airtable attachment CDN URL", () => {
    const table = parseCsvTable(
      "Name,Attachments\nA,\"file.png (https://dl.airtable.com/.attachments/x/file.png)\"\n",
    );
    const diagnostics = new DiagnosticCollector();
    normalizeTable("Tasks.csv", table, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });

  it("leaves a row's title undefined when the primary field is blank", () => {
    const table = parseCsvTable("Name,Email\n,jane@example.com\n");
    const result = normalizeTable("Contacts.csv", table, new DiagnosticCollector());
    expect(result.documents[0]?.title).toBeUndefined();
  });

  it("warns when a table has no columns", () => {
    const diagnostics = new DiagnosticCollector();
    const result = normalizeTable("Empty.csv", { headers: [], rows: [] }, diagnostics);
    expect(result.documents).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "warning")).toBe(true);
  });
});
