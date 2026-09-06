import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeTaskList } from "./normalize.js";
import type { GoogleTaskList } from "./parse-source.js";

describe("normalizeTaskList", () => {
  it("normalizes tasks into documents under the list's collection", () => {
    const list: GoogleTaskList = {
      kind: "tasks#taskList",
      id: "list1",
      title: "My Tasks",
      items: [{ kind: "tasks#task", id: "t1", title: "Do the thing", notes: "details", status: "needsAction" }],
    };
    const diagnostics = new DiagnosticCollector();
    const result = normalizeTaskList("My Tasks.json", list, diagnostics);

    expect(result.collection.title).toBe("My Tasks");
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.parentId).toBe(result.collection.id);
    expect(result.documents[0]?.content).toBe("details");
    expect(result.documents[0]?.metadata?.googleTasks).toMatchObject({ status: "needsAction" });
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("creates a sub-task-of relation when the parent task is present", () => {
    const list: GoogleTaskList = {
      kind: "tasks#taskList",
      id: "list1",
      items: [
        { kind: "tasks#task", id: "t1", title: "Parent" },
        { kind: "tasks#task", id: "t2", title: "Child", parent: "t1" },
      ],
    };
    const result = normalizeTaskList("list.json", list, new DiagnosticCollector());
    expect(result.relations).toContainEqual(
      expect.objectContaining({
        relationKind: "sub-task-of",
        fromId: "google-tasks:document:t2",
        toId: "google-tasks:document:t1",
      }),
    );
  });

  it("reports a missing-reference diagnostic for a dangling parent", () => {
    const list: GoogleTaskList = {
      kind: "tasks#taskList",
      id: "list1",
      items: [{ kind: "tasks#task", id: "t1", title: "Orphan", parent: "ghost" }],
    };
    const diagnostics = new DiagnosticCollector();
    normalizeTaskList("list.json", list, diagnostics);
    expect(diagnostics.all().some((d) => d.category === "missing-reference")).toBe(true);
  });

  it("skips a task with no id and reports malformed-source", () => {
    const list: GoogleTaskList = {
      kind: "tasks#taskList",
      id: "list1",
      items: [{ kind: "tasks#task", title: "No id" }],
    };
    const diagnostics = new DiagnosticCollector();
    const result = normalizeTaskList("list.json", list, diagnostics);
    expect(result.documents).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("reports malformed-source for a task with no title but still keeps it", () => {
    const list: GoogleTaskList = {
      kind: "tasks#taskList",
      id: "list1",
      items: [{ kind: "tasks#task", id: "t1" }],
    };
    const diagnostics = new DiagnosticCollector();
    const result = normalizeTaskList("list.json", list, diagnostics);
    expect(result.documents).toHaveLength(1);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });
});
