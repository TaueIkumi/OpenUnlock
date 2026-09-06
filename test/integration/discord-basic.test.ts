import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { discordAdapter } from "../../src/adapters/discord/index.js";
import { jsonExporter } from "../../src/exporters/json/index.js";
import { markdownExporter } from "../../src/exporters/markdown/index.js";
import { filesystemExporter } from "../../src/exporters/filesystem/index.js";
import { runDoctor } from "../../src/cli/commands/doctor.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/discord/fixtures/basic");
const snapshotsDir = path.join(testDir, "../snapshots/discord/basic");

describe("discord basic fixture end-to-end", () => {
  it("produces deterministic, golden-matching JSON output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-discord-json-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, discordAdapter, jsonExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      expect(result.diagnostics.hasErrors()).toBe(false);

      const entities = await readFile(path.join(outDir, "entities.json"), "utf8");
      const expectedEntities = await readFile(path.join(snapshotsDir, "json/entities.json"), "utf8");
      expect(entities).toBe(expectedEntities);

      const manifest = await readFile(path.join(outDir, "openunlock.json"), "utf8");
      const expectedManifest = await readFile(path.join(snapshotsDir, "json/openunlock.json"), "utf8");
      expect(manifest).toBe(expectedManifest);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("produces deterministic, golden-matching Markdown output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-discord-md-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, discordAdapter, markdownExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const files = (await readdir(path.join(outDir, "conversations"))).sort();
      const expectedFiles = (await readdir(path.join(snapshotsDir, "markdown"))).sort();
      expect(files).toEqual(expectedFiles);

      for (const file of files) {
        const generated = await readFile(path.join(outDir, "conversations", file), "utf8");
        const expected = await readFile(path.join(snapshotsDir, "markdown", file), "utf8");
        expect(generated).toBe(expected);
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("passes doctor validation for the filesystem exporter", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-discord-fs-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, discordAdapter, filesystemExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const findings = await runDoctor(outDir);
      expect(findings).toEqual([]);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
