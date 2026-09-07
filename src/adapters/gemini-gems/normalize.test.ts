import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../core/diagnostics.js";
import { normalizeGem } from "./normalize.js";

describe("normalizeGem", () => {
  it("maps a Gem to a Document with its instructions as content", () => {
    const diagnostics = new DiagnosticCollector();
    const doc = normalizeGem(
      "gemini_gems_data.html",
      { name: "Recipe Helper", instructions: "Suggest a dinner recipe.", files: [] },
      0,
      diagnostics,
    );
    expect(doc.title).toBe("Recipe Helper");
    expect(doc.content).toBe("Suggest a dinner recipe.");
    expect(doc.format).toBe("text");
    expect(diagnostics.hasErrors()).toBe(false);
  });

  it("reports lossy-conversion when a Gem references files", () => {
    const diagnostics = new DiagnosticCollector();
    const doc = normalizeGem(
      "gemini_gems_data.html",
      { name: "Icon Maker", instructions: "...", files: [{ url: "https://x", filename: "ref.png" }] },
      0,
      diagnostics,
    );
    expect(doc.metadata?.geminiGems).toMatchObject({
      files: [{ url: "https://x", filename: "ref.png" }],
    });
    expect(diagnostics.all().some((d) => d.category === "lossy-conversion")).toBe(true);
  });

  it("reports malformed-source for a Gem with no name, but still converts it", () => {
    const diagnostics = new DiagnosticCollector();
    const doc = normalizeGem("gemini_gems_data.html", { name: "", instructions: "x", files: [] }, 0, diagnostics);
    expect(doc.title).toBeUndefined();
    expect(diagnostics.all().some((d) => d.category === "malformed-source")).toBe(true);
  });

  it("produces stable, unique ids across Gems with the same name", () => {
    const diagnostics = new DiagnosticCollector();
    const gem = { name: "Duplicate", instructions: "x", files: [] };
    const a = normalizeGem("gemini_gems_data.html", gem, 0, diagnostics);
    const b = normalizeGem("gemini_gems_data.html", gem, 1, diagnostics);
    expect(a.id).not.toBe(b.id);
  });
});
