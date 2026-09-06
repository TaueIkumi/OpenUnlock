import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { slackAdapter } from "../../src/adapters/slack/index.js";
import { markdownExporter } from "../../src/exporters/markdown/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/slack/fixtures/threads");
const snapshotsDir = path.join(testDir, "../snapshots/slack/threads/markdown");

describe("slack threads fixture end-to-end", () => {
  it("preserves thread order in a single conversation file and matches the golden output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-slack-md-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, slackAdapter, markdownExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      expect(result.diagnostics.hasErrors()).toBe(false);

      const generatedFiles = await readdir(path.join(outDir, "conversations"));
      const expectedFiles = await readdir(snapshotsDir);
      expect(generatedFiles).toEqual(expectedFiles);

      const generated = await readFile(
        path.join(outDir, "conversations", generatedFiles[0]!),
        "utf8",
      );
      const expected = await readFile(path.join(snapshotsDir, expectedFiles[0]!), "utf8");
      expect(generated).toBe(expected);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
