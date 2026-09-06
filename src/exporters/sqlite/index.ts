import path from "node:path";
import { createRequire } from "node:module";
import { unlink } from "node:fs/promises";
import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { UnsupportedFormatError } from "../../core/errors.js";
import { buildManifest, countByType, ensureOutputDir, sortEntitiesDeterministically } from "../shared.js";
import { CREATE_TABLES_SQL } from "./schema.js";

type SqlValue = string | number | null;

function loadDatabaseSyncCtor() {
  try {
    // Using require() via createRequire rather than a dynamic import():
    // under Vitest, dynamic import() of a `node:` builtin gets routed
    // through vite-node's own module graph, which mishandles the `node:`
    // scheme; require() bypasses that and always resolves natively.
    const require = createRequire(import.meta.url);
    const mod = require("node:sqlite") as typeof import("node:sqlite");
    return mod.DatabaseSync;
  } catch {
    throw new UnsupportedFormatError(
      "The sqlite exporter requires Node.js 22.5+ (for the built-in node:sqlite module). " +
        "No separate database engine needs to be installed, but this Node runtime doesn't have it.",
    );
  }
}

function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

const BASE_COLUMNS = "id, title, created_at, updated_at, source_service, source_id, source_path, metadata_json";

function baseValues(entity: AnyCanonicalEntity): SqlValue[] {
  return [
    entity.id,
    entity.title ?? null,
    entity.createdAt ?? null,
    entity.updatedAt ?? null,
    entity.source.service,
    entity.source.sourceId ?? null,
    entity.source.sourcePath ?? null,
    toJson(entity.metadata),
  ];
}

/**
 * SQLite output for local querying and analysis — NOT part of the
 * Git-friendly text-format family (markdown/json/jsonl/filesystem). A
 * binary database file can't be usefully diffed, so this exporter trades
 * that property away deliberately in exchange for SQL queryability
 * (AGENT.md section 5, "SQLite can follow shortly after the base schema
 * stabilizes").
 */
export const sqliteExporter: Exporter = {
  id: "sqlite",

  async export(
    entities: AsyncIterable<AnyCanonicalEntity>,
    context: ExportContext,
  ): Promise<ExportResult> {
    await ensureOutputDir(context);

    const collected: AnyCanonicalEntity[] = [];
    for await (const entity of entities) {
      collected.push(entity);
    }

    const sorted = sortEntitiesDeterministically(collected);
    const entityCounts = countByType(sorted);
    const manifest = buildManifest(context.sourceService, entityCounts);

    const DatabaseSync = loadDatabaseSyncCtor();

    const dbPath = context.dryRun ? ":memory:" : path.join(context.outputDir, "openunlock.sqlite");
    if (!context.dryRun) {
      // A stale file from a previous --overwrite run would make CREATE
      // TABLE fail (or silently mix old and new rows) — start fresh.
      await unlink(dbPath).catch(() => {});
    }

    const db = new DatabaseSync(dbPath);
    try {
      db.exec(CREATE_TABLES_SQL);
      db.exec("BEGIN");

      db.prepare(
        "INSERT INTO openunlock_manifest (schema_version, openunlock_version, source, entity_counts_json) VALUES (?, ?, ?, ?)",
      ).run(
        String(manifest.schemaVersion),
        String(manifest.openunlockVersion),
        String(manifest.source),
        JSON.stringify(manifest.entityCounts),
      );

      const diagnosticStmt = db.prepare(
        "INSERT INTO diagnostic (seq, category, message, ref) VALUES (?, ?, ?, ?)",
      );
      context.diagnostics.all().forEach((d, i) => {
        diagnosticStmt.run(i, d.category, d.message, d.ref ?? null);
      });

      const workspaceStmt = db.prepare(`INSERT INTO workspace (${BASE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      const collectionStmt = db.prepare(
        `INSERT INTO collection (${BASE_COLUMNS}, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const documentStmt = db.prepare(
        `INSERT INTO document (${BASE_COLUMNS}, content, format, parent_id, attachments_json, relations_json) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const conversationStmt = db.prepare(
        `INSERT INTO conversation (${BASE_COLUMNS}, participant_ids_json, message_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const messageStmt = db.prepare(
        `INSERT INTO message (${BASE_COLUMNS}, conversation_id, author_id, parent_message_id, content, attachments_json) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const personStmt = db.prepare(
        `INSERT INTO person (${BASE_COLUMNS}, display_name, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const attachmentStmt = db.prepare(
        `INSERT INTO attachment (${BASE_COLUMNS}, filename, media_type, size, checksum, local_path) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const relationStmt = db.prepare(
        `INSERT INTO relation (${BASE_COLUMNS}, from_id, to_id, relation_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const entity of sorted) {
        const base = baseValues(entity);

        switch (entity.type) {
          case "workspace":
            workspaceStmt.run(...base);
            break;
          case "collection":
            collectionStmt.run(...base, entity.parentId ?? null);
            break;
          case "document":
            documentStmt.run(
              ...base,
              entity.content,
              entity.format,
              entity.parentId ?? null,
              toJson(entity.attachments),
              toJson(entity.relations),
            );
            break;
          case "conversation":
            conversationStmt.run(...base, toJson(entity.participantIds), JSON.stringify(entity.messageIds));
            break;
          case "message":
            messageStmt.run(
              ...base,
              entity.conversationId ?? null,
              entity.authorId ?? null,
              entity.parentMessageId ?? null,
              entity.content,
              toJson(entity.attachments),
            );
            break;
          case "person":
            personStmt.run(...base, entity.displayName ?? null, entity.email ?? null);
            break;
          case "attachment":
            attachmentStmt.run(
              ...base,
              entity.filename,
              entity.mediaType ?? null,
              entity.size ?? null,
              entity.checksum ?? null,
              entity.localPath,
            );
            break;
          case "relation":
            relationStmt.run(...base, entity.fromId, entity.toId, entity.relationKind);
            break;
        }
      }

      db.exec("COMMIT");
    } finally {
      db.close();
    }

    return { filesWritten: context.dryRun ? 0 : 1, entityCounts };
  },
};
