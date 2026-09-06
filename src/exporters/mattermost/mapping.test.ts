import { describe, expect, it } from "vitest";
import {
  threadMessages,
  toEpochMillis,
  toMattermostChannelName,
  toMattermostEmail,
  toMattermostTeamName,
  toMattermostUsername,
} from "./mapping.js";
import type { Message, Person } from "../../core/canonical/types.js";

describe("toMattermostTeamName", () => {
  it("slugifies the workspace title", () => {
    expect(toMattermostTeamName({ id: "w1", type: "workspace", title: "My Team!", source: { service: "slack" } }, "slack")).toBe(
      "my-team",
    );
  });

  it("falls back to a source-derived name when there's no workspace", () => {
    expect(toMattermostTeamName(undefined, "slack")).toBe("slack-import");
  });
});

describe("toMattermostUsername", () => {
  it("produces a valid, unique username from a display name", () => {
    const username = toMattermostUsername({
      id: "p1",
      type: "person",
      displayName: "Alice Doe",
      source: { service: "slack", sourceId: "U1" },
    });
    expect(username).toMatch(/^[a-z][a-z0-9.\-_]{2,21}$/);
    expect(username).toContain("alicedoe");
  });

  it("stays valid even with no display name at all", () => {
    const username = toMattermostUsername({ id: "p1", type: "person", source: { service: "slack" } });
    expect(username).toMatch(/^[a-z][a-z0-9.\-_]{2,21}$/);
  });

  it("produces different usernames for people with the same display name", () => {
    const a = toMattermostUsername({
      id: "p1",
      type: "person",
      displayName: "Sam",
      source: { service: "slack", sourceId: "U1" },
    });
    const b = toMattermostUsername({
      id: "p2",
      type: "person",
      displayName: "Sam",
      source: { service: "slack", sourceId: "U2" },
    });
    expect(a).not.toBe(b);
  });
});

describe("toMattermostChannelName", () => {
  it("slugifies the conversation title with a uniqueness suffix", () => {
    const name = toMattermostChannelName({
      id: "c1",
      type: "conversation",
      title: "General Chat",
      messageIds: [],
      source: { service: "slack", sourceId: "C1" },
    });
    expect(name).toMatch(/^general-chat-[0-9a-f]{8}$/);
  });
});

describe("toMattermostEmail", () => {
  it("uses the person's real email when present", () => {
    const person: Person = { id: "p1", type: "person", email: "a@example.com", source: { service: "slack" } };
    expect(toMattermostEmail(person, "alice")).toBe("a@example.com");
  });

  it("synthesizes a reserved-domain placeholder email otherwise", () => {
    const person: Person = { id: "p1", type: "person", source: { service: "slack" } };
    expect(toMattermostEmail(person, "alice")).toBe("alice@imported.invalid");
  });
});

describe("toEpochMillis", () => {
  it("converts an ISO timestamp to epoch milliseconds", () => {
    expect(toEpochMillis("2024-01-01T00:00:00.000Z")).toBe(Date.parse("2024-01-01T00:00:00.000Z"));
  });

  it("returns 0 for a missing or invalid timestamp", () => {
    expect(toEpochMillis(undefined)).toBe(0);
    expect(toEpochMillis("not-a-date")).toBe(0);
  });
});

describe("threadMessages", () => {
  function msg(id: string, parentMessageId: string | undefined, authorId = "p1"): Message {
    return {
      id,
      type: "message",
      parentMessageId,
      authorId,
      content: id,
      source: { service: "slack" },
    };
  }

  it("groups a root message and its replies into one thread", () => {
    const threads = threadMessages([msg("root", undefined), msg("r1", "root"), msg("r2", "root")]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.rootMessage.id).toBe("root");
    expect(threads[0]?.replies.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("flattens a reply-to-a-reply onto the original thread root", () => {
    const threads = threadMessages([msg("root", undefined), msg("r1", "root"), msg("r2", "r1")]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("treats an unrelated message as its own thread root", () => {
    const threads = threadMessages([msg("a", undefined), msg("b", undefined)]);
    expect(threads).toHaveLength(2);
  });

  it("does not infinite-loop on a self-referential parent (malformed data)", () => {
    const cyclic = msg("a", "a");
    expect(() => threadMessages([cyclic])).not.toThrow();
  });
});
