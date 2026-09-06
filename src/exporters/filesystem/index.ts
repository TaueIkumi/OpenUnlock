import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { checksum, shortId } from "../../utils/hashing.js";
import {
  buildManifest,
  countByType,
  ensureOutputDir,
  serializeDiagnostics,
  serializeJson,
  sortEntitiesDeterministically,
  writeBinaryFile,
  writeJsonFile,
} from "../shared.js";

const TYPE_DIRS: Record<AnyCanonicalEntity["type"], string> = {
  workspace: "workspace",
  collection: "collections",
  document: "documents",
  conversation: "conversations",
  message: "messages",
  person: "people",
  attachment: "attachments",
  relation: "relations",
};

export const filesystemExporter: Exporter = {
  id: "filesystem",

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

    const checksums: Record<string, string> = {};

    let filesWritten = 0;
    for (const entity of sorted) {
      const dir = TYPE_DIRS[entity.type];
      const filename = `${shortId(entity.source.service, entity.id)}.json`;
      const relativePath = `${dir}/${filename}`;
      await writeJsonFile(context, relativePath, entity);
      checksums[relativePath] = checksum(serializeJson(entity));
      filesWritten++;

      if (entity.type === "attachment") {
        const blob = context.attachmentBlobs?.get(entity.id);
        if (blob) {
          await writeBinaryFile(context, entity.localPath, blob);
          checksums[entity.localPath] = checksum(blob);
          filesWritten++;
        }
      }
    }

    const diagnosticsPayload = serializeDiagnostics(context.diagnostics.all());
    await writeJsonFile(context, "openunlock.json", manifest);
    await writeJsonFile(context, "diagnostics.json", diagnosticsPayload);
    checksums["openunlock.json"] = checksum(serializeJson(manifest));
    checksums["diagnostics.json"] = checksum(serializeJson(diagnosticsPayload));
    filesWritten += 2;

    // checksums.json enumerates every other file this exporter wrote, keyed
    // by relative path and sorted for deterministic, diffable output. It
    // never includes itself. `doctor` uses it to detect corruption or manual
    // edits (AGENT.md section 15, "checksum mismatches").
    const sortedChecksums: Record<string, string> = {};
    for (const key of Object.keys(checksums).sort()) {
      sortedChecksums[key] = checksums[key]!;
    }
    await writeJsonFile(context, "checksums.json", sortedChecksums);
    filesWritten += 1;

    return { filesWritten, entityCounts };
  },
};
