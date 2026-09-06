import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import {
  buildManifest,
  countByType,
  ensureOutputDir,
  serializeDiagnostics,
  sortEntitiesDeterministically,
  writeJsonFile,
} from "../shared.js";

export const jsonExporter: Exporter = {
  id: "json",

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

    await writeJsonFile(context, "openunlock.json", manifest);
    await writeJsonFile(context, "entities.json", sorted);
    await writeJsonFile(context, "diagnostics.json", serializeDiagnostics(context.diagnostics.all()));

    return { filesWritten: 3, entityCounts };
  },
};
