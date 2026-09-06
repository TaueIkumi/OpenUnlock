import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { chatGptAdapter } from "../../src/adapters/chatgpt/index.js";
import { jsonExporter } from "../../src/exporters/json/index.js";
import { markdownExporter } from "../../src/exporters/markdown/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/chatgpt/fixtures/basic");
const snapshotsDir = path.join(testDir, "../snapshots/chatgpt/basic");

describe("chatgpt basic fixture end-to-end", () => {
  it("produces deterministic, golden-matching JSON output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-json-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, chatGptAdapter, jsonExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      expect(result.diagnostics.hasErrors()).toBe(false);

      const entities = await readFile(path.join(outDir, "entities.json"), "utf8");
      const expectedEntities = await readFile(
        path.join(snapshotsDir, "json/entities.json"),
        "utf8",
      );
      expect(entities).toBe(expectedEntities);

      const manifest = await readFile(path.join(outDir, "openunlock.json"), "utf8");
      const expectedManifest = await readFile(
        path.join(snapshotsDir, "json/openunlock.json"),
        "utf8",
      );
      expect(manifest).toBe(expectedManifest);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("produces deterministic, golden-matching Markdown output", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-md-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, chatGptAdapter, markdownExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const files = await readdir(path.join(outDir, "conversations"));
      expect(files).toHaveLength(1);

      const generated = await readFile(path.join(outDir, "conversations", files[0]!), "utf8");
      const expectedFiles = await readdir(path.join(snapshotsDir, "markdown"));
      const expected = await readFile(
        path.join(snapshotsDir, "markdown", expectedFiles[0]!),
        "utf8",
      );

      expect(files[0]).toBe(expectedFiles[0]);
      expect(generated).toBe(expected);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("running conversion twice produces byte-identical output (deterministic)", async () => {
    const outDir1 = await mkdtemp(path.join(tmpdir(), "openunlock-a-"));
    const outDir2 = await mkdtemp(path.join(tmpdir(), "openunlock-b-"));
    try {
      const input1 = await openInputSource(fixtureDir);
      const input2 = await openInputSource(fixtureDir);

      await runPipeline(input1, chatGptAdapter, jsonExporter, {
        outputDir: outDir1,
        overwrite: true,
        dryRun: false,
      });
      await runPipeline(input2, chatGptAdapter, jsonExporter, {
        outputDir: outDir2,
        overwrite: true,
        dryRun: false,
      });

      const a = await readFile(path.join(outDir1, "entities.json"), "utf8");
      const b = await readFile(path.join(outDir2, "entities.json"), "utf8");
      expect(a).toBe(b);
    } finally {
      await rm(outDir1, { recursive: true, force: true });
      await rm(outDir2, { recursive: true, force: true });
    }
  });
});
