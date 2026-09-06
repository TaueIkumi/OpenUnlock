import { mkdir, writeFile, stat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AnyCanonicalEntity } from "../core/canonical/types.js";
import type { ExportContext } from "../core/exporter.js";
import type { Diagnostic } from "../core/diagnostics.js";
import { SCHEMA_VERSION } from "../core/canonical/schema.js";
import { WriteError } from "../core/errors.js";
import { resolveWithinRoot } from "../utils/paths.js";

const OPENUNLOCK_VERSION = "0.1.0";

/** Deterministic ordering: by type, then id. Never insertion order. */
export function sortEntitiesDeterministically(
  entities: AnyCanonicalEntity[],
): AnyCanonicalEntity[] {
  return [...entities].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.id.localeCompare(b.id);
  });
}

export function countByType(entities: AnyCanonicalEntity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Files any exporter writes at the archive root that mark a directory as
 * "an OpenUnlock output" — used to decide whether --overwrite is allowed
 * to clear a non-empty directory, or should refuse (see below).
 */
const OPENUNLOCK_OUTPUT_MARKERS = ["openunlock.json", "openunlock.sqlite"];

export async function ensureOutputDir(context: ExportContext): Promise<void> {
  if (context.dryRun) return;

  let exists = false;
  try {
    await stat(context.outputDir);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    const entries = await readdir(context.outputDir);
    if (entries.length > 0) {
      if (!context.overwrite) {
        throw new WriteError(
          `Output directory is not empty: ${context.outputDir}. Use --overwrite to write anyway.`,
        );
      }

      if (!entries.some((e) => OPENUNLOCK_OUTPUT_MARKERS.includes(e))) {
        throw new WriteError(
          `Output directory is not empty and doesn't look like a previous OpenUnlock export ` +
            `(no openunlock.json or openunlock.sqlite found): ${context.outputDir}. Refusing to ` +
            `clear a directory OpenUnlock didn't create — point --output at an empty directory.`,
        );
      }

      // --overwrite on a real prior OpenUnlock export means "replace with
      // fresh output", not "merge with what was there before". Without
      // this, an entity removed from a newer export leaves its old file
      // behind forever, defeating the "repeated export into the same
      // directory -> clean git diff" workflow (AGENT.md section 16,
      // Git-Friendly Mode) — the diff would only ever show additions.
      await rm(context.outputDir, { recursive: true, force: true });
    }
  }

  await mkdir(context.outputDir, { recursive: true });
}

/** Canonical JSON serialization used for both writing and checksumming files. */
export function serializeJson(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

export async function writeJsonFile(
  context: ExportContext,
  relativePath: string,
  data: unknown,
): Promise<void> {
  if (context.dryRun) return;
  const fullPath = path.join(context.outputDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  try {
    await writeFile(fullPath, serializeJson(data), "utf8");
  } catch (err) {
    throw new WriteError(`Failed to write ${fullPath}`, { cause: err });
  }
}

export async function writeTextFile(
  context: ExportContext,
  relativePath: string,
  content: string,
): Promise<void> {
  if (context.dryRun) return;
  const fullPath = path.join(context.outputDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  try {
    await writeFile(fullPath, content, "utf8");
  } catch (err) {
    throw new WriteError(`Failed to write ${fullPath}`, { cause: err });
  }
}

/**
 * Write raw bytes (e.g. an attachment recovered from the source export).
 * Unlike writeJsonFile/writeTextFile, `relativePath` here can originate
 * from adapter-controlled data (Attachment.localPath), so it's validated
 * to stay within the output root before anything touches disk (AGENT.md
 * section 17: every extracted path must be validated before writing).
 */
export async function writeBinaryFile(
  context: ExportContext,
  relativePath: string,
  data: Buffer,
): Promise<void> {
  if (context.dryRun) return;
  const fullPath = resolveWithinRoot(context.outputDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  try {
    await writeFile(fullPath, data);
  } catch (err) {
    throw new WriteError(`Failed to write ${fullPath}`, { cause: err });
  }
}

export function buildManifest(
  sourceService: string,
  entityCounts: Record<string, number>,
): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    openunlockVersion: OPENUNLOCK_VERSION,
    source: sourceService,
    entityCounts,
  };
}

export function serializeDiagnostics(diagnostics: readonly Diagnostic[]): unknown {
  return diagnostics.map((d) => ({ category: d.category, message: d.message, ref: d.ref }));
}
