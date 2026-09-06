import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { evernoteAdapter } from "../../src/adapters/evernote/index.js";
import { htmlArchiveExporter } from "../../src/exporters/html/index.js";
import { runDoctor } from "../../src/cli/commands/doctor.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/evernote/fixtures/basic");
const snapshotsDir = path.join(testDir, "../snapshots/html/evernote-basic");

describe("html archive exporter", () => {
  it("produces a deterministic, golden-matching, browsable static site", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-html-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, evernoteAdapter, htmlArchiveExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });
      expect(result.diagnostics.hasErrors()).toBe(false);

      const index = await readFile(path.join(outDir, "index.html"), "utf8");
      const expectedIndex = await readFile(path.join(snapshotsDir, "index.html"), "utf8");
      expect(index).toBe(expectedIndex);

      const files = (await readdir(path.join(outDir, "documents"))).sort();
      const expectedFiles = (await readdir(path.join(snapshotsDir, "documents"))).sort();
      expect(files).toEqual(expectedFiles);

      for (const file of files) {
        const generated = await readFile(path.join(outDir, "documents", file), "utf8");
        const expected = await readFile(path.join(snapshotsDir, "documents", file), "utf8");
        expect(generated).toBe(expected);
      }

      // The embedded image must be a real, working relative link, and its
      // bytes must actually be copied (not just referenced).
      const tripPage = await readFile(
        path.join(outDir, "documents", "2024-01-10-trip-planning--324f7d9c.html"),
        "utf8",
      );
      expect(tripPage).toContain('src="../attachments/93e54d4e-map.png"');
      const copiedBytes = await readFile(path.join(outDir, "attachments", "93e54d4e-map.png"));
      const expectedBytes = await readFile(path.join(snapshotsDir, "93e54d4e-map.png"));
      expect(copiedBytes.equals(expectedBytes)).toBe(true);

      const findings = await runDoctor(outDir);
      expect(findings.some((f) => f.message.includes("Orphaned attachment file"))).toBe(false);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
