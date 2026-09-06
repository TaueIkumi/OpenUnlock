import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { chatGptAdapter } from "../../src/adapters/chatgpt/index.js";
import { sqliteExporter } from "../../src/exporters/sqlite/index.js";
import { runDoctor } from "../../src/cli/commands/doctor.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/chatgpt/fixtures/basic");

function openDb(dbPath: string) {
  // See src/exporters/sqlite/index.ts for why this is require(), not import().
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  return new DatabaseSync(dbPath, { readOnly: true });
}

// node:sqlite requires Node.js 22.5+ (see exporters/sqlite/index.ts). This
// package still declares engines.node >=18 because that only gates the
// rest of the CLI — the sqlite exporter itself degrades to a clear error
// on an older runtime instead of crashing. These tests must degrade the
// same way, or `pnpm test` breaks for anyone (or any CI job) on Node <22.5.
function hasNodeSqlite(): boolean {
  try {
    createRequire(import.meta.url)("node:sqlite");
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasNodeSqlite())("sqlite exporter", () => {
  it("writes a queryable database with the manifest, entities, and diagnostics", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-sqlite-"));
    try {
      const input = await openInputSource(fixtureDir);
      const result = await runPipeline(input, chatGptAdapter, sqliteExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      expect(result.exportResult.filesWritten).toBe(1);

      const db = await openDb(path.join(outDir, "openunlock.sqlite"));
      try {
        const manifest = db.prepare("SELECT * FROM openunlock_manifest").get() as Record<
          string,
          unknown
        >;
        expect(manifest.source).toBe("chatgpt");
        expect(JSON.parse(String(manifest.entity_counts_json))).toEqual({
          conversation: 1,
          message: 2,
          person: 2,
        });

        const conversations = db.prepare("SELECT id, title FROM conversation").all();
        expect(conversations).toHaveLength(1);

        const messages = db.prepare("SELECT id, content, conversation_id FROM message ORDER BY id").all();
        expect(messages).toHaveLength(2);
      } finally {
        db.close();
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("produces identical query results across repeated conversions (deterministic ordering)", async () => {
    const outDirA = await mkdtemp(path.join(tmpdir(), "openunlock-sqlite-a-"));
    const outDirB = await mkdtemp(path.join(tmpdir(), "openunlock-sqlite-b-"));
    try {
      for (const outDir of [outDirA, outDirB]) {
        const input = await openInputSource(fixtureDir);
        await runPipeline(input, chatGptAdapter, sqliteExporter, {
          outputDir: outDir,
          overwrite: true,
          dryRun: false,
        });
      }

      const dbA = await openDb(path.join(outDirA, "openunlock.sqlite"));
      const dbB = await openDb(path.join(outDirB, "openunlock.sqlite"));
      try {
        const messagesA = dbA.prepare("SELECT * FROM message ORDER BY id").all();
        const messagesB = dbB.prepare("SELECT * FROM message ORDER BY id").all();
        expect(messagesA).toEqual(messagesB);
      } finally {
        dbA.close();
        dbB.close();
      }
    } finally {
      await rm(outDirA, { recursive: true, force: true });
      await rm(outDirB, { recursive: true, force: true });
    }
  });

  it("doesn't falsely report a missing manifest to doctor (sqlite has no openunlock.json)", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-sqlite-doctor-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, chatGptAdapter, sqliteExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const findings = await runDoctor(outDir);
      expect(findings.some((f) => f.severity === "error")).toBe(false);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
