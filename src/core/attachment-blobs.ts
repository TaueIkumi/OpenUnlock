/**
 * In-memory store for attachment bytes an adapter recovers directly from a
 * source export that embeds them inline (e.g. Evernote's base64-encoded
 * <resource> data). Most exports only reference attachments by path or URL
 * without the bytes — those adapters simply never write to this store, and
 * exporters fall back to their existing metadata-only, lossy-conversion
 * behavior when a blob isn't present (AGENT.md section 2.3, Preserve
 * before transforming).
 *
 * Kept out of the canonical entity model on purpose: entities flow through
 * JSON serialization and validation (core/pipeline.ts), and embedding raw
 * bytes (or their base64 form) there would bloat every JSON/JSONL output
 * file and defeat Git-friendly diffing (AGENT.md section 2.5).
 */
export class AttachmentBlobStore {
  private readonly blobs = new Map<string, Buffer>();

  set(attachmentId: string, data: Buffer): void {
    this.blobs.set(attachmentId, data);
  }

  get(attachmentId: string): Buffer | undefined {
    return this.blobs.get(attachmentId);
  }
}
