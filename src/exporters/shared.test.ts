import { describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ensureOutputDir } from "./shared.js";
import { DiagnosticCollector } from "../core/diagnostics.js";
import { WriteError } from "../core/errors.js";
import type { ExportContext } from "../core/exporter.js";

function context(outputDir: string, overwrite: boolean): ExportContext {
  return {
    outputDir,
    sourceService: "test",
    diagnostics: new DiagnosticCollector(),
    overwrite,
    dryRun: false,
  };
}

describe("ensureOutputDir", () => {
  it("creates the directory when it doesn't exist yet", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    const target = path.join(base, "nested", "dir");
    try {
      await ensureOutputDir(context(target, false));
      expect((await stat(target)).isDirectory()).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("succeeds without --overwrite when the directory is already empty", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    try {
      await expect(ensureOutputDir(context(dir, false))).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses a non-empty directory without --overwrite", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    try {
      await writeFile(path.join(dir, "openunlock.json"), "{}");
      await expect(ensureOutputDir(context(dir, false))).rejects.toThrow(WriteError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses to clear a non-empty directory that isn't a prior OpenUnlock export, even with --overwrite", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    try {
      await writeFile(path.join(dir, "keep-me.txt"), "important, unrelated file");
      await expect(ensureOutputDir(context(dir, true))).rejects.toThrow(WriteError);
      // The file must survive the refused attempt.
      const entries = await readdir(dir);
      expect(entries).toEqual(["keep-me.txt"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("clears a directory that looks like a prior OpenUnlock export when --overwrite is set", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    try {
      await writeFile(path.join(dir, "openunlock.json"), "{}");
      await writeFile(path.join(dir, "stale-entity.json"), "{}");
      await ensureOutputDir(context(dir, true));
      const entries = await readdir(dir);
      expect(entries).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("recognizes an openunlock.sqlite manifest as a prior export too", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "openunlock-ensure-"));
    try {
      await writeFile(path.join(dir, "openunlock.sqlite"), "");
      await ensureOutputDir(context(dir, true));
      expect(await readdir(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
