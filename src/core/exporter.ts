import type { AnyCanonicalEntity } from "./canonical/types.js";
import type { DiagnosticCollector } from "./diagnostics.js";
import type { AttachmentBlobStore } from "./attachment-blobs.js";

export interface ExportContext {
  outputDir: string;
  sourceService: string;
  diagnostics: DiagnosticCollector;
  overwrite: boolean;
  dryRun: boolean;
  /** Attachment bytes the adapter recovered from the source export, if any. */
  attachmentBlobs?: AttachmentBlobStore;
}

export interface ExportResult {
  filesWritten: number;
  entityCounts: Record<string, number>;
}

/**
 * Every output format implements this. See AGENT.md section 9.
 *
 * An exporter MUST consume only canonical entities and MUST NOT import
 * source-adapter-specific logic.
 */
export interface Exporter {
  readonly id: string;

  export(
    entities: AsyncIterable<AnyCanonicalEntity>,
    context: ExportContext,
  ): Promise<ExportResult>;
}
