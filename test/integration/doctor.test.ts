import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { chatGptAdapter } from "../../src/adapters/chatgpt/index.js";
import { evernoteAdapter } from "../../src/adapters/evernote/index.js";
import { jsonExporter } from "../../src/exporters/json/index.js";
import { filesystemExporter } from "../../src/exporters/filesystem/index.js";
import { markdownExporter } from "../../src/exporters/markdown/index.js";
import { obsidianExporter } from "../../src/exporters/obsidian/index.js";
import { runDoctor } from "../../src/cli/commands/doctor.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/chatgpt/fixtures/basic");

describe("doctor", () => {
  it("reports no issues for a valid converted archive", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-ok-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, chatGptAdapter, jsonExporter, {
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

  it("flags a missing manifest", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-nomanifest-"));
    try {
      const findings = await runDoctor(outDir);
      expect(findings.some((f) => f.severity === "error" && f.message.includes("manifest"))).toBe(
        true,
      );
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("flags a dangling message reference", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-broken-"));
    try {
      await writeFile(
        path.join(outDir, "openunlock.json"),
        JSON.stringify({
          schemaVersion: "1",
          openunlockVersion: "0.1.0",
          source: "chatgpt",
          entityCounts: { conversation: 1 },
        }),
      );
      await writeFile(
        path.join(outDir, "entities.json"),
        JSON.stringify([
          {
            id: "conv-1",
            type: "conversation",
            source: { service: "chatgpt" },
            messageIds: ["missing-message"],
          },
        ]),
      );

      const findings = await runDoctor(outDir);
      expect(
        findings.some((f) => f.severity === "error" && f.message.includes("missing message")),
      ).toBe(true);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("reports no issues for a valid filesystem-exported archive with checksums", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-fs-ok-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, chatGptAdapter, filesystemExporter, {
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

  it("flags a checksum mismatch when a file is modified after conversion", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-checksum-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, chatGptAdapter, filesystemExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      await writeFile(path.join(outDir, "openunlock.json"), '{"tampered":true}');

      const findings = await runDoctor(outDir);
      expect(
        findings.some(
          (f) => f.severity === "error" && f.message.includes("Checksum mismatch for openunlock.json"),
        ),
      ).toBe(true);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("flags a checksums.json entry pointing at a missing file", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-checksum-missing-"));
    try {
      await writeFile(
        path.join(outDir, "openunlock.json"),
        JSON.stringify({
          schemaVersion: "1",
          openunlockVersion: "0.1.0",
          source: "chatgpt",
          entityCounts: {},
        }),
      );
      await writeFile(
        path.join(outDir, "checksums.json"),
        JSON.stringify({ "entities.json": "deadbeef" }),
      );

      const findings = await runDoctor(outDir);
      expect(
        findings.some(
          (f) => f.severity === "error" && f.message.includes("references missing file: entities.json"),
        ),
      ).toBe(true);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("flags an orphaned attachment file not referenced by any entity", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-orphan-"));
    try {
      await writeFile(
        path.join(outDir, "openunlock.json"),
        JSON.stringify({
          schemaVersion: "1",
          openunlockVersion: "0.1.0",
          source: "chatgpt",
          entityCounts: {},
        }),
      );
      await writeFile(path.join(outDir, "entities.json"), JSON.stringify([]));
      const { mkdir } = await import("node:fs/promises");
      await mkdir(path.join(outDir, "attachments"), { recursive: true });
      await writeFile(path.join(outDir, "attachments", "orphan.bin"), "data");

      const findings = await runDoctor(outDir);
      expect(
        findings.some((f) => f.severity === "warning" && f.message.includes("Orphaned attachment file")),
      ).toBe(true);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("does not flag an attachment's own metadata sidecar as orphaned (regression)", async () => {
    // Evernote is the first adapter that both creates real Attachment
    // entities AND provides bytes for them to copy — this combination is
    // what exposed the false positive (the filesystem exporter's own
    // <shortId>.json sidecar under attachments/ was mistaken for an
    // unreferenced raw file).
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-evernote-"));
    try {
      const fixtureDir = path.join(testDir, "../../src/adapters/evernote/fixtures/basic");
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, evernoteAdapter, filesystemExporter, {
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

  it.each([
    ["markdown", markdownExporter],
    ["obsidian", obsidianExporter],
  ])(
    "does not flag a copied attachment as orphaned for %s output (regression)",
    async (_name, exporter) => {
      // Neither exporter emits canonical JSON entity records at all (only
      // rendered text and, when a blob is available, the raw attachment
      // file) — loadEntities must recognize that as "no ground truth to
      // check against" rather than "declares zero entities", or every
      // copied attachment looks orphaned.
      const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-doctor-md-family-"));
      try {
        const fixtureDir = path.join(testDir, "../../src/adapters/evernote/fixtures/basic");
        const input = await openInputSource(fixtureDir);
        await runPipeline(input, evernoteAdapter, exporter, {
          outputDir: outDir,
          overwrite: true,
          dryRun: false,
        });

        const findings = await runDoctor(outDir);
        expect(findings.some((f) => f.message.includes("Orphaned attachment file"))).toBe(false);
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );
});
