import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeExport } from "./normalize.js";
import { parseCsvTable } from "../../utils/csv.js";

describe("normalizeExport", () => {
  it("normalizes issues into documents grouped by team, with an assignee person", () => {
    const table = parseCsvTable(
      "ID,Title,Description,Assignee,Team,Created\n" +
        "ENG-1,Do the thing,Body,Alice,Engineering,2024-01-01T00:00:00.000Z\n",
    );
    const diagnostics = new DiagnosticCollector();
    const result = normalizeExport(table, diagnostics);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.id).toBe("linear:document:ENG-1");
    expect(result.documents[0]?.parentId).toBe("linear:collection:engineering");
    expect(result.collections).toHaveLength(1);
    expect(result.people).toHaveLength(1);
    expect(result.people[0]?.displayName).toBe("Alice");
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("creates a sub-issue-of relation when the parent issue is present", () => {
    const table = parseCsvTable(
      "ID,Title,Parent issue\n" + "ENG-1,Parent,\n" + "ENG-2,Child,ENG-1\n",
    );
    const result = normalizeExport(table, new DiagnosticCollector());
    expect(result.relations).toContainEqual(
      expect.objectContaining({
        relationKind: "sub-issue-of",
        fromId: "linear:document:ENG-2",
        toId: "linear:document:ENG-1",
      }),
    );
  });

  it("reports a missing-reference diagnostic for a dangling parent", () => {
    const table = parseCsvTable("ID,Title,Parent issue\n" + "ENG-1,Orphan,ENG-999\n");
    const diagnostics = new DiagnosticCollector();
    normalizeExport(table, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("skips a row with no id and reports malformed-source", () => {
    const table = parseCsvTable("ID,Title\n,Blank id\n");
    const diagnostics = new DiagnosticCollector();
    const result = normalizeExport(table, diagnostics);
    expect(result.documents).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("reports malformed-source for an unparseable timestamp", () => {
    const table = parseCsvTable("ID,Title,Created\n" + "ENG-1,Title,not-a-date\n");
    const diagnostics = new DiagnosticCollector();
    normalizeExport(table, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });
});
