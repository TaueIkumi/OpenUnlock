import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { notionAdapter } from "../../src/adapters/notion/index.js";
import { markdownExporter } from "../../src/exporters/markdown/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/notion/fixtures/basic");
const snapshotsDir = path.join(testDir, "../snapshots/notion/basic/markdown");

describe("notion basic fixture end-to-end", () => {
  it("rewrites internal links to relative paths and matches the golden output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-notion-md-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, notionAdapter, markdownExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      expect(result.diagnostics.hasErrors()).toBe(false);

      const generatedFiles = (await readdir(path.join(outDir, "documents"))).sort();
      const expectedFiles = (await readdir(snapshotsDir)).sort();
      expect(generatedFiles).toEqual(expectedFiles);

      for (const filename of generatedFiles) {
        const generated = await readFile(path.join(outDir, "documents", filename), "utf8");
        const expected = await readFile(path.join(snapshotsDir, filename), "utf8");
        expect(generated).toBe(expected);
      }

      // The rewritten link must be a relative path, not the raw
      // openunlock://entity/ placeholder or the original Notion filename.
      const projectPlan = await readFile(
        path.join(outDir, "documents", generatedFiles.find((f) => f.includes("project-plan"))!),
        "utf8",
      );
      expect(projectPlan).not.toContain("openunlock://entity/");
      expect(projectPlan).toMatch(/\]\(\.\/undated-meeting-notes--[a-f0-9]{8}\.md\)/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
