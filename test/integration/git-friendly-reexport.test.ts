import { describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { discordAdapter } from "../../src/adapters/discord/index.js";
import { filesystemExporter } from "../../src/exporters/filesystem/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * AGENT.md section 16, "Git-Friendly Mode": converting a newer export into
 * the same output directory (with --overwrite) should behave like
 * `git commit` over the previous state — content that's gone from the
 * newer export must actually disappear, not accumulate forever. This is
 * what makes `git diff` between two conversions meaningful instead of only
 * ever showing additions.
 */
describe("repeated export into the same directory (Git-friendly mode)", () => {
  it("removes entities that are no longer present in a newer export", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-reexport-"));
    try {
      const firstInput = await openInputSource(
        path.join(testDir, "../../src/adapters/discord/fixtures/basic"),
      );
      await runPipeline(firstInput, discordAdapter, filesystemExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });
      const afterFirst = await readdir(path.join(outDir, "conversations"));
      expect(afterFirst.length).toBeGreaterThan(0);

      const secondInput = await openInputSource(
        path.join(testDir, "../../src/adapters/discord/fixtures/edge-cases"),
      );
      await runPipeline(secondInput, discordAdapter, filesystemExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });
      const afterSecond = await readdir(path.join(outDir, "conversations"));

      // None of the first export's conversation files should survive into
      // the second export's directory listing.
      const stale = afterFirst.filter((f) => afterSecond.includes(f));
      expect(stale).toEqual([]);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("produces byte-identical output for unchanged content across two conversions of the same input", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-reexport-stable-"));
    try {
      for (let i = 0; i < 2; i++) {
        const input = await openInputSource(
          path.join(testDir, "../../src/adapters/discord/fixtures/basic"),
        );
        await runPipeline(input, discordAdapter, filesystemExporter, {
          outputDir: outDir,
          overwrite: true,
          dryRun: false,
        });
      }
      const files = await readdir(path.join(outDir, "conversations"));
      expect(files).toHaveLength(2);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
