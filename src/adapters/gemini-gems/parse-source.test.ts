import { describe, expect, it } from "vitest";
import { isEmptyTakeoutFragment, parseGeminiGems } from "./parse-source.js";

describe("parseGeminiGems", () => {
  it("parses a Gem with a file, positionally (not by label text)", () => {
    const html =
      '<div><b>名前:</b>Icon Maker<br><b>カスタム指示:</b>Generate a 512x512 icon.<br>' +
      '<b>ファイル数:</b><br><a href="https://example.com/a">reference.png</a><br><br></div>';
    const gems = parseGeminiGems(html);
    expect(gems).toHaveLength(1);
    expect(gems[0]).toEqual({
      name: "Icon Maker",
      instructions: "Generate a 512x512 icon.",
      files: [{ url: "https://example.com/a", filename: "reference.png" }],
    });
  });

  it("parses a file-less Gem the same way regardless of label language", () => {
    const html = "<div><b>Name:</b>Travel Planner<br><b>Custom instructions:</b>Plan a trip.<br><br></div>";
    const gems = parseGeminiGems(html);
    expect(gems).toEqual([{ name: "Travel Planner", instructions: "Plan a trip.", files: [] }]);
  });

  it("parses multiple Gems, mixing file-less and with-file entries", () => {
    const html =
      "<div>" +
      '<b>Name:</b>A<br><b>Custom instructions:</b>Do A.<br><b>Files:</b><br><a href="u1">f1</a><br><br><br>' +
      "<b>Name:</b>B<br><b>Custom instructions:</b>Do B.<br><br>" +
      "</div>";
    const gems = parseGeminiGems(html);
    expect(gems.map((g) => g.name)).toEqual(["A", "B"]);
    expect(gems[0]?.files).toEqual([{ url: "u1", filename: "f1" }]);
    expect(gems[1]?.files).toEqual([]);
  });

  it("decodes HTML entities in names, instructions, and file names", () => {
    const html =
      "<div><b>Name:</b>Tom &amp; Jerry<br><b>Custom instructions:</b>Use &lt;b&gt; tags.<br><br></div>";
    const gems = parseGeminiGems(html);
    expect(gems[0]?.name).toBe("Tom & Jerry");
    expect(gems[0]?.instructions).toBe("Use <b> tags.");
  });

  it("returns an empty array for a structurally empty export", () => {
    expect(parseGeminiGems("<div></div>")).toEqual([]);
  });

  it("returns an empty array for content with no recognizable label structure", () => {
    expect(parseGeminiGems("<div>just some text</div>")).toEqual([]);
  });
});

describe("isEmptyTakeoutFragment", () => {
  it("recognizes an empty div, tolerating whitespace", () => {
    expect(isEmptyTakeoutFragment("<div></div>")).toBe(true);
    expect(isEmptyTakeoutFragment("<div>  \n </div>")).toBe(true);
  });

  it("recognizes non-empty content", () => {
    expect(isEmptyTakeoutFragment("<div>something</div>")).toBe(false);
  });
});
