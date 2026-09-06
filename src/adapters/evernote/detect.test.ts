import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../core/input.js";
import { detectEvernote } from "./detect.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("detectEvernote", () => {
  it("detects a well-formed .enex export with high confidence", async () => {
    const input = await openInputSource(path.join(fixturesDir, "basic"));
    const result = await detectEvernote(input);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns zero confidence when no .enex file is present", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-evernote-none-"));
    try {
      await writeFile(path.join(dir, "notes.json"), "{}");
      const input = await openInputSource(dir);
      const result = await detectEvernote(input);
      expect(result.confidence).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns zero confidence for a .enex file that isn't a real export", async () => {
    const input = await openInputSource(path.join(fixturesDir, "malformed"));
    const result = await detectEvernote(input);
    expect(result.confidence).toBe(0);
  });
});
