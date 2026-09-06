import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvTable } from "./csv.js";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('name,note\n"Doe, John",hello\n')).toEqual([
      ["name", "note"],
      ["Doe, John", "hello"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsv('a\n"she said ""hi"""\n')).toEqual([["a"], ['she said "hi"']]);
  });

  it("handles quoted fields with embedded newlines", () => {
    expect(parseCsv('a\n"line1\nline2"\n')).toEqual([["a"], ["line1\nline2"]]);
  });
});

describe("parseCsvTable", () => {
  it("maps rows to header-keyed records", () => {
    const table = parseCsvTable("Name,Status\nWrite adapter,Done\n");
    expect(table.headers).toEqual(["Name", "Status"]);
    expect(table.rows).toEqual([{ Name: "Write adapter", Status: "Done" }]);
  });
});
