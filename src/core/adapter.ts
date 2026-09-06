import type { InputSource } from "./input.js";
import type { DiagnosticCollector } from "./diagnostics.js";
import type { AnyCanonicalEntity } from "./canonical/types.js";
import type { AttachmentBlobStore } from "./attachment-blobs.js";

export interface DetectionResult {
  adapter: string;
  confidence: number;
  evidence: string[];
}

export interface InspectionContent {
  label: string;
  count: number;
}

export interface InspectionResult {
  source: string;
  confidence: number;
  contents: InspectionContent[];
  potentialIssues: string[];
}

export interface AdapterContext {
  diagnostics: DiagnosticCollector;
  /**
   * Optional sink for attachment bytes recovered directly from the source
   * export (see AttachmentBlobStore). Most adapters never touch this.
   */
  attachmentBlobs?: AttachmentBlobStore;
}

/**
 * Every source adapter implements this. See AGENT.md section 8.
 *
 * An adapter MUST NOT render output formats, write destination-specific
 * structures, call remote APIs, or silently drop unsupported source
 * objects — unsupported data must be reported via AdapterContext.diagnostics.
 */
export interface SourceAdapter {
  readonly id: string;
  readonly displayName: string;

  detect(input: InputSource): Promise<DetectionResult>;

  inspect(input: InputSource): Promise<InspectionResult>;

  parse(input: InputSource, context: AdapterContext): AsyncIterable<AnyCanonicalEntity>;
}
