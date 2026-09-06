import { Command } from "commander";
import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { canonicalEntitySchema, SCHEMA_VERSION } from "../../core/canonical/schema.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { checksum, shortId } from "../../utils/hashing.js";
import { sanitizeFilenameSegment } from "../../utils/filenames.js";
import { printJson, printLine } from "../output.js";
import { handleCliError } from "../handle-error.js";

interface DoctorOptions {
  json?: boolean;
}

interface DoctorFinding {
  severity: "error" | "warning";
  message: string;
}

const ENTITY_DIRS = [
  "workspace",
  "collections",
  "documents",
  "conversations",
  "messages",
  "people",
  "attachments",
  "relations",
];

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor <archive>")
    .description("Validate an OpenUnlock output directory")
    .option("--json", "print machine-readable JSON")
    .action(async (archiveDir: string, options: DoctorOptions) => {
      try {
        const findings = await runDoctor(archiveDir);

        if (options.json) {
          printJson({ findings });
        } else {
          if (findings.length === 0) {
            printLine("✓ No issues found");
          }
          for (const finding of findings) {
            printLine(`${finding.severity === "error" ? "✗" : "⚠"} ${finding.message}`);
          }
        }

        if (findings.some((f) => f.severity === "error")) {
          process.exitCode = 1;
        }
      } catch (err) {
        handleCliError(err);
      }
    });
}

async function loadManifest(archiveDir: string): Promise<Record<string, unknown> | undefined> {
  try {
    const text = await readFile(path.join(archiveDir, "openunlock.json"), "utf8");
    return JSON.parse(text);
  } catch {
    // Fall through — this may be sqlite output instead, which has no
    // openunlock.json (its manifest lives in a table inside the .sqlite
    // file; see exporters/sqlite/schema.ts).
  }

  const sqlitePath = path.join(archiveDir, "openunlock.sqlite");
  if (!(await pathExists(sqlitePath))) {
    return undefined;
  }

  try {
    // See exporters/sqlite/index.ts for why this uses require() rather
    // than a dynamic import() of the `node:` builtin.
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const row = db.prepare("SELECT * FROM openunlock_manifest").get() as
        | Record<string, unknown>
        | undefined;
      if (!row) return undefined;
      return {
        schemaVersion: row.schema_version,
        openunlockVersion: row.openunlock_version,
        source: row.source,
        entityCounts: JSON.parse(String(row.entity_counts_json)),
      };
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

interface LoadedEntities {
  entities: AnyCanonicalEntity[];
  /**
   * Whether canonical entity data was discoverable at all — false for
   * markdown/obsidian output, which only ever writes rendered text and
   * raw attachment bytes, never canonical JSON records. Entity-dependent
   * checks (e.g. orphaned attachment files) must not run when this is
   * false: an empty `entities` array here means "we have no ground truth
   * to check against", not "this archive declares zero entities".
   */
  discoverable: boolean;
}

async function loadEntities(archiveDir: string, findings: DoctorFinding[]): Promise<LoadedEntities> {
  const entities: AnyCanonicalEntity[] = [];

  const entitiesJsonPath = path.join(archiveDir, "entities.json");
  const entitiesJsonlPath = path.join(archiveDir, "entities.jsonl");

  if (await pathExists(entitiesJsonPath)) {
    const raw = JSON.parse(await readFile(entitiesJsonPath, "utf8"));
    if (Array.isArray(raw)) {
      entities.push(...validateEach(raw, findings, "entities.json"));
    }
    return { entities, discoverable: true };
  }

  if (await pathExists(entitiesJsonlPath)) {
    const text = await readFile(entitiesJsonlPath, "utf8");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const raw = lines.map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        findings.push({ severity: "error", message: `entities.jsonl line ${i + 1} is not valid JSON` });
        return undefined;
      }
    });
    entities.push(...validateEach(raw.filter(Boolean), findings, "entities.jsonl"));
    return { entities, discoverable: true };
  }

  // A per-type directory (e.g. attachments/) can exist for non-canonical
  // output too — markdown/obsidian write raw attachment bytes there, with
  // no .json sidecar — so "the directory exists" alone doesn't mean
  // canonical data is present; only actually finding a .json file does.
  let foundAnyJsonFile = false;
  for (const dir of ENTITY_DIRS) {
    const dirPath = path.join(archiveDir, dir);
    if (!(await pathExists(dirPath))) continue;
    const files = await readdir(dirPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    if (jsonFiles.length === 0) continue;
    foundAnyJsonFile = true;
    for (const file of jsonFiles) {
      const raw = JSON.parse(await readFile(path.join(dirPath, file), "utf8"));
      entities.push(...validateEach([raw], findings, `${dir}/${file}`));
    }
  }

  if (!foundAnyJsonFile) {
    findings.push({
      severity: "warning",
      message:
        "No canonical entity data found (entities.json, entities.jsonl, or per-type directories). " +
        "Deep validation is unavailable for this output format; only the manifest was checked.",
    });
  }

  return { entities, discoverable: foundAnyJsonFile };
}

function validateEach(
  raw: unknown[],
  findings: DoctorFinding[],
  location: string,
): AnyCanonicalEntity[] {
  const valid: AnyCanonicalEntity[] = [];
  for (const item of raw) {
    const result = canonicalEntitySchema.safeParse(item);
    if (result.success) {
      valid.push(result.data as AnyCanonicalEntity);
    } else {
      const id = typeof item === "object" && item && "id" in item ? String(item.id) : "unknown";
      findings.push({
        severity: "error",
        message: `Invalid canonical entity in ${location} (id: ${id}): ${result.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
    }
  }
  return valid;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively list every file under `dir`, as paths relative to `dir` (POSIX-style). */
async function walkFiles(dir: string, base = dir): Promise<string[]> {
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
  return files;
}

async function checkFilenames(archiveDir: string, findings: DoctorFinding[]): Promise<void> {
  const files = await walkFiles(archiveDir);
  for (const relativePath of files) {
    for (const segment of relativePath.split("/")) {
      if (sanitizeFilenameSegment(segment) !== segment) {
        findings.push({
          severity: "warning",
          message: `Unsafe or non-portable filename: ${relativePath}`,
        });
        break;
      }
    }
  }
}

async function checkChecksumsManifest(archiveDir: string, findings: DoctorFinding[]): Promise<void> {
  const checksumsPath = path.join(archiveDir, "checksums.json");
  if (!(await pathExists(checksumsPath))) return;

  let recorded: Record<string, string>;
  try {
    recorded = JSON.parse(await readFile(checksumsPath, "utf8"));
  } catch {
    findings.push({ severity: "error", message: "checksums.json is not valid JSON" });
    return;
  }

  for (const [relativePath, expected] of Object.entries(recorded)) {
    const filePath = path.join(archiveDir, relativePath);
    if (!(await pathExists(filePath))) {
      findings.push({
        severity: "error",
        message: `checksums.json references missing file: ${relativePath}`,
      });
      continue;
    }
    const actual = checksum(await readFile(filePath));
    if (actual !== expected) {
      findings.push({
        severity: "error",
        message: `Checksum mismatch for ${relativePath} (file was modified after conversion)`,
      });
    }
  }
}

async function checkOrphanedAttachmentFiles(
  archiveDir: string,
  entities: AnyCanonicalEntity[],
  findings: DoctorFinding[],
): Promise<void> {
  const attachmentsDir = path.join(archiveDir, "attachments");
  if (!(await pathExists(attachmentsDir))) return;

  const attachmentEntities = entities.filter(
    (e): e is Extract<AnyCanonicalEntity, { type: "attachment" }> => e.type === "attachment",
  );

  const referenced = new Set<string>();
  for (const entity of attachmentEntities) {
    // The attachment's actual bytes, if the exporter copied them.
    referenced.add(path.normalize(path.join(archiveDir, entity.localPath)));
    // The filesystem exporter's own canonical-JSON sidecar for this entity
    // (see exporters/filesystem/index.ts) — not an orphan, just metadata.
    referenced.add(
      path.normalize(
        path.join(attachmentsDir, `${shortId(entity.source.service, entity.id)}.json`),
      ),
    );
  }

  const files = await walkFiles(attachmentsDir);
  for (const relativePath of files) {
    const fullPath = path.normalize(path.join(attachmentsDir, relativePath));
    if (!referenced.has(fullPath)) {
      findings.push({
        severity: "warning",
        message: `Orphaned attachment file not referenced by any entity: attachments/${relativePath}`,
      });
    }
  }
}

export async function runDoctor(archiveDir: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  if (!(await pathExists(archiveDir))) {
    return [{ severity: "error", message: `Archive directory not found: ${archiveDir}` }];
  }

  const manifest = await loadManifest(archiveDir);
  if (!manifest) {
    findings.push({ severity: "error", message: "openunlock.json manifest not found" });
  } else if (manifest.schemaVersion !== SCHEMA_VERSION) {
    findings.push({
      severity: "warning",
      message: `Manifest schema version "${String(manifest.schemaVersion)}" does not match installed version "${SCHEMA_VERSION}"`,
    });
  }

  await checkFilenames(archiveDir, findings);
  await checkChecksumsManifest(archiveDir, findings);

  const { entities, discoverable } = await loadEntities(archiveDir, findings);
  if (discoverable) {
    await checkOrphanedAttachmentFiles(archiveDir, entities, findings);
  }

  if (entities.length === 0) {
    return findings;
  }

  const byId = new Map<string, AnyCanonicalEntity>();
  for (const entity of entities) {
    if (byId.has(entity.id)) {
      findings.push({ severity: "error", message: `Duplicate entity id: ${entity.id}` });
    } else {
      byId.set(entity.id, entity);
    }
  }

  for (const entity of entities) {
    if (entity.type === "conversation") {
      for (const messageId of entity.messageIds) {
        if (!byId.has(messageId)) {
          findings.push({
            severity: "error",
            message: `Conversation ${entity.id} references missing message ${messageId}`,
          });
        }
      }
    }

    if (entity.type === "message") {
      if (entity.conversationId && !byId.has(entity.conversationId)) {
        findings.push({
          severity: "error",
          message: `Message ${entity.id} references missing conversation ${entity.conversationId}`,
        });
      }
      if (entity.parentMessageId && !byId.has(entity.parentMessageId)) {
        findings.push({
          severity: "error",
          message: `Message ${entity.id} references missing parent message ${entity.parentMessageId}`,
        });
      }
    }

    if (entity.type === "relation") {
      if (!byId.has(entity.fromId)) {
        findings.push({
          severity: "error",
          message: `Relation ${entity.id} references missing entity ${entity.fromId}`,
        });
      }
      if (!byId.has(entity.toId)) {
        findings.push({
          severity: "error",
          message: `Relation ${entity.id} references missing entity ${entity.toId}`,
        });
      }
    }

    if (entity.type === "attachment" && entity.checksum) {
      const attachmentPath = path.join(archiveDir, entity.localPath);
      if (!(await pathExists(attachmentPath))) {
        findings.push({
          severity: "error",
          message: `Attachment ${entity.id} references missing file: ${entity.localPath}`,
        });
      } else {
        const data = await readFile(attachmentPath);
        if (checksum(data) !== entity.checksum) {
          findings.push({
            severity: "error",
            message: `Attachment ${entity.id} checksum mismatch: ${entity.localPath}`,
          });
        }
      }
    }
  }

  return findings;
}
