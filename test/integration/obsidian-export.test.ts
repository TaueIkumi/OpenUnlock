import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { notionAdapter } from "../../src/adapters/notion/index.js";
import { evernoteAdapter } from "../../src/adapters/evernote/index.js";
import { obsidianExporter } from "../../src/exporters/obsidian/index.js";
import { runDoctor } from "../../src/cli/commands/doctor.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotsDir = path.join(testDir, "../snapshots/obsidian");

describe("obsidian exporter", () => {
  it("rewrites a page-to-page link into a Wikilink with a display alias (Notion fixture)", async () => {
    const fixtureDir = path.join(testDir, "../../src/adapters/notion/fixtures/basic");
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-obsidian-notion-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, notionAdapter, obsidianExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });
      expect(result.diagnostics.hasErrors()).toBe(false);

      const files = (await readdir(path.join(outDir, "documents"))).sort();
      const expectedFiles = (await readdir(path.join(snapshotsDir, "notion-basic"))).sort();
      expect(files).toEqual(expectedFiles);

      for (const file of files) {
        const generated = await readFile(path.join(outDir, "documents", file), "utf8");
        const expected = await readFile(path.join(snapshotsDir, "notion-basic", file), "utf8");
        expect(generated).toBe(expected);
      }

      const projectPlan = await readFile(
        path.join(outDir, "documents", "undated-project-plan--8284a2b3.md"),
        "utf8",
      );
      expect(projectPlan).toContain("[[undated-meeting-notes--1ca5bcc1|Meeting Notes]]");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("rewrites an image reference into an embed Wikilink and copies the real bytes (Evernote fixture)", async () => {
    const fixtureDir = path.join(testDir, "../../src/adapters/evernote/fixtures/basic");
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-obsidian-evernote-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, evernoteAdapter, obsidianExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });
      expect(result.diagnostics.hasErrors()).toBe(false);

      const tripPlanning = await readFile(
        path.join(outDir, "documents", "2024-01-10-trip-planning--324f7d9c.md"),
        "utf8",
      );
      expect(tripPlanning).toContain("![[93e54d4e-map.png]]");

      const attachmentFiles = await readdir(path.join(outDir, "attachments"));
      expect(attachmentFiles).toHaveLength(1);
      const copiedBytes = await readFile(path.join(outDir, "attachments", attachmentFiles[0]!));
      const expectedBytes = await readFile(path.join(snapshotsDir, "evernote-basic", attachmentFiles[0]!));
      expect(copiedBytes.equals(expectedBytes)).toBe(true);

      const findings = await runDoctor(outDir);
      expect(findings.some((f) => f.message.includes("Orphaned attachment file"))).toBe(false);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
