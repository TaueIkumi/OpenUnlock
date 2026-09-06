import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { chatGptAdapter } from "../../src/adapters/chatgpt/index.js";
import { filesystemExporter } from "../../src/exporters/filesystem/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/chatgpt/fixtures/basic");

async function walkFiles(dir: string, base = dir): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, fullPath).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

describe("deterministic output (AGENT.md section 2.4, Phase 4)", () => {
  it("produces byte-identical output when converting the same input twice", async () => {
    const outDirA = await mkdtemp(path.join(tmpdir(), "openunlock-determinism-a-"));
    const outDirB = await mkdtemp(path.join(tmpdir(), "openunlock-determinism-b-"));
    try {
      for (const outDir of [outDirA, outDirB]) {
        const input = await openInputSource(fixtureDir);
        await runPipeline(input, chatGptAdapter, filesystemExporter, {
          outputDir: outDir,
          overwrite: true,
          dryRun: false,
        });
      }

      const filesA = await walkFiles(outDirA);
      const filesB = await walkFiles(outDirB);
      expect(filesA).toEqual(filesB);

      for (const relativePath of filesA) {
        const contentA = await readFile(path.join(outDirA, relativePath), "utf8");
        const contentB = await readFile(path.join(outDirB, relativePath), "utf8");
        expect(contentA).toBe(contentB);
      }
    } finally {
      await rm(outDirA, { recursive: true, force: true });
      await rm(outDirB, { recursive: true, force: true });
    }
  });
});
