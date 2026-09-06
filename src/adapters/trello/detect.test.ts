import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectTrello } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectTrello", () => {
  it("detects a well-formed Trello board export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectTrello(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns zero confidence when no JSON file matches the Trello structure", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-trello-none-"));
    try {
      await writeFile(path.join(dir, "notes.json"), JSON.stringify({ hello: "world" }));
      const input = await openInputSource(dir);
      const result = await detectTrello(input);
      expect(result.confidence).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns zero confidence for malformed JSON", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectTrello(input);
    expect(result.confidence).toBe(0);
  });

  it("detects a loose board file (not wrapped in a directory)", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic", "board.json"));
    const result = await detectTrello(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
