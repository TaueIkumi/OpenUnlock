import type { SourceAdapter } from "./adapter.js";
import type { Exporter, ExportResult } from "./exporter.js";
import type { InputSource } from "./input.js";
import { DiagnosticCollector } from "./diagnostics.js";
import { AttachmentBlobStore } from "./attachment-blobs.js";
import { validateCanonicalEntity } from "./canonical/validation.js";

export interface PipelineOptions {
  outputDir: string;
  overwrite: boolean;
  dryRun: boolean;
}

export interface PipelineResult {
  sourceId: string;
  exportResult: ExportResult;
  diagnostics: DiagnosticCollector;
}

/**
 * Wire an adapter's parsed entities into an exporter, validating each
 * entity against the canonical schema on the way through. This is the only
 * place adapters and exporters meet (AGENT.md section 7).
 */
export async function runPipeline(
  input: InputSource,
  adapter: SourceAdapter,
  exporter: Exporter,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const diagnostics = new DiagnosticCollector();
  const attachmentBlobs = new AttachmentBlobStore();
  const adapterContext = { diagnostics, attachmentBlobs };

  async function* validatedEntities() {
    for await (const entity of adapter.parse(input, adapterContext)) {
      yield validateCanonicalEntity(entity);
    }
  }

  const exportResult = await exporter.export(validatedEntities(), {
    outputDir: options.outputDir,
    sourceService: adapter.id,
    diagnostics,
    overwrite: options.overwrite,
    dryRun: options.dryRun,
    attachmentBlobs,
  });

  return { sourceId: adapter.id, exportResult, diagnostics };
}
