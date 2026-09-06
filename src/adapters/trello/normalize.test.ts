import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeBoard } from "./normalize.js";
import type { TrelloBoard } from "./parse-source.js";

describe("normalizeBoard", () => {
  it("normalizes lists, cards, members, and comments", () => {
    const raw: TrelloBoard = {
      id: "board1",
      name: "Board",
      lists: [{ id: "list1", name: "To Do" }],
      members: [{ id: "member1", fullName: "Alice" }],
      cards: [
        {
          id: "card1",
          name: "Task",
          desc: "Do the thing",
          idList: "list1",
          idMembers: ["member1"],
        },
      ],
      actions: [
        {
          id: "action1",
          type: "commentCard",
          idMemberCreator: "member1",
          data: { text: "On it", card: { id: "card1" } },
        },
        { id: "action2", type: "updateCard" },
      ],
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeBoard(raw, diagnostics);

    expect(result.workspace.id).toBe("trello:workspace:board1");
    expect(result.collections).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.parentId).toBe("trello:collection:list1");
    expect(result.people).toHaveLength(1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.authorId).toBe("trello:person:member1");
    expect(result.relations).toContainEqual(
      expect.objectContaining({ relationKind: "assigned-to", fromId: "trello:document:card1" }),
    );
    expect(result.relations).toContainEqual(
      expect.objectContaining({ relationKind: "comment-on", toId: "trello:document:card1" }),
    );
    expect(diagnostics.all().some((d) => d.category === "unsupported")).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("renders checklists into the card's content", () => {
    const raw: TrelloBoard = {
      id: "board1",
      name: "Board",
      lists: [{ id: "list1", name: "To Do" }],
      cards: [{ id: "card1", name: "Task", desc: "Body", idList: "list1" }],
      checklists: [
        {
          id: "checklist1",
          name: "Steps",
          idCard: "card1",
          checkItems: [
            { id: "i1", name: "Done thing", state: "complete" },
            { id: "i2", name: "Pending thing", state: "incomplete" },
          ],
        },
      ],
    };

    const result = normalizeBoard(raw, new DiagnosticCollector());
    const content = result.documents[0]?.content ?? "";
    expect(content).toContain("Body");
    expect(content).toContain("- [x] Done thing");
    expect(content).toContain("- [ ] Pending thing");
  });

  it("reports missing references instead of dropping data silently", () => {
    const raw: TrelloBoard = {
      id: "board1",
      name: "Board",
      lists: [],
      members: [],
      cards: [{ id: "card1", name: "Orphan", idList: "missing-list", idMembers: ["missing-member"] }],
      actions: [
        {
          id: "action1",
          type: "commentCard",
          idMemberCreator: "missing-member",
          data: { text: "hi", card: { id: "card1" } },
        },
        {
          id: "action2",
          type: "commentCard",
          data: { text: "hi", card: { id: "missing-card" } },
        },
      ],
    };

    const diagnostics = new DiagnosticCollector();
    const result = normalizeBoard(raw, diagnostics);

    expect(result.documents[0]?.parentId).toBeUndefined();
    expect(result.relations.some((r) => r.relationKind === "assigned-to")).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.authorId).toBeUndefined();
    const missingRefs = diagnostics.all().filter((d) => d.category === "missing-reference");
    expect(missingRefs.length).toBeGreaterThanOrEqual(3);
  });
});
