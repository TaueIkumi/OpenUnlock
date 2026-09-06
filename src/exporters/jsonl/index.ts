import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import {
  buildManifest,
  countByType,
  ensureOutputDir,
  serializeDiagnostics,
  sortEntitiesDeterministically,
  writeJsonFile,
  writeTextFile,
} from "../shared.js";

export const jsonlExporter: Exporter = {
  id: "jsonl",

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

    const jsonl = sorted.map((entity) => JSON.stringify(entity)).join("\n") + "\n";

    await writeJsonFile(context, "openunlock.json", manifest);
    await writeTextFile(context, "entities.jsonl", jsonl);
    await writeJsonFile(context, "diagnostics.json", serializeDiagnostics(context.diagnostics.all()));

    return { filesWritten: 3, entityCounts };
  },
};
