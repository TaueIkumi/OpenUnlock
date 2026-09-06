import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { buildSelfPerson, normalizeChannel, SELF_PERSON_ID } from "./normalize.js";

describe("buildSelfPerson", () => {
  it("uses the account username when available", () => {
    const person = buildSelfPerson({ id: "1", username: "alice", email: "a@example.com" });
    expect(person.id).toBe(SELF_PERSON_ID);
    expect(person.displayName).toBe("alice");
    expect(person.email).toBe("a@example.com");
  });

  it("falls back to a generic label when account/user.json is absent", () => {
    const person = buildSelfPerson(undefined);
    expect(person.displayName).toBe("You");
  });
});

describe("normalizeChannel", () => {
  it("normalizes messages, sorted chronologically, all authored by the account owner", () => {
    const diagnostics = new DiagnosticCollector();
    const result = normalizeChannel(
      "1001",
      "general",
      { type: 0, guild: { id: "g1", name: "My Server" } },
      [
        { ID: "2", Timestamp: "2024-02-01 09:05:00", Contents: "second" },
        { ID: "1", Timestamp: "2024-02-01 09:00:00", Contents: "first" },
      ],
      diagnostics,
    );

    expect(result.conversation.title).toBe("general");
    expect(result.conversation.participantIds).toEqual([SELF_PERSON_ID]);
    expect(result.messages.map((m) => m.id)).toEqual(["discord:message:1", "discord:message:2"]);
    expect(result.messages.every((m) => m.authorId === SELF_PERSON_ID)).toBe(true);
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("drops a message missing ID and reports malformed-source", () => {
    const diagnostics = new DiagnosticCollector();
    const result = normalizeChannel(
      "1001",
      "general",
      {},
      [{ Timestamp: "2024-02-01 09:00:00", Contents: "no id" }],
      diagnostics,
    );
    expect(result.messages).toHaveLength(0);
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("reports a lossy-conversion diagnostic for attachment URLs", () => {
    const diagnostics = new DiagnosticCollector();
    const result = normalizeChannel(
      "1001",
      "general",
      {},
      [{ ID: "1", Timestamp: "2024-02-01 09:00:00", Contents: "see attached", Attachments: "https://cdn.discordapp.com/a.png" }],
      diagnostics,
    );
    expect(result.messages[0]?.metadata?.discord).toMatchObject({
      attachmentUrls: ["https://cdn.discordapp.com/a.png"],
    });
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });
});
