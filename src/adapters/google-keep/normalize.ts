import path from "node:path";
import type { InputSource } from "../../core/input.js";
import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import type { Attachment, Document } from "../../core/canonical/types.js";
import { checksum, shortId } from "../../utils/hashing.js";
import { sanitizeFilenameSegment } from "../../utils/filenames.js";
import { normalizeKeepTimestamp } from "./parse-source.js";
import type { GoogleKeepNote } from "./parse-source.js";

export interface NormalizedNote {
  document: Document;
  attachments: Attachment[];
}

function renderContent(note: GoogleKeepNote): string {
  if (note.listContent && note.listContent.length > 0) {
    return note.listContent
      .map((item) => `- [${item.isChecked ? "x" : " "}] ${item.text ?? ""}`)
      .join("\n");
  }
  return note.textContent ?? "";
}

export async function normalizeNote(
  notePath: string,
  note: GoogleKeepNote,
  input: InputSource,
  diagnostics: DiagnosticCollector,
  attachmentBlobs?: AttachmentBlobStore,
): Promise<NormalizedNote> {
  const fingerprint = shortId(
    "google-keep",
    notePath,
    note.title ?? "",
    String(note.createdTimestampUsec ?? ""),
  );
  const documentId = `google-keep:document:${fingerprint}`;

  if (note.createdTimestampUsec === undefined && note.userEditedTimestampUsec === undefined) {
    diagnostics.malformedSource("Note has no creation or edit timestamp", documentId);
  }

  const attachments: Attachment[] = [];
  const noteDir = path.posix.dirname(notePath);

  for (const [index, raw] of (note.attachments ?? []).entries()) {
    if (!raw.filePath) {
      diagnostics.unsupported(`Attachment ${index} has no filePath`, documentId);
      continue;
    }

    const attachmentSourcePath = path.posix.normalize(path.posix.join(noteDir, raw.filePath));
    if (!(await input.hasFile(attachmentSourcePath))) {
      diagnostics.missingReference(
        `Attachment references ${attachmentSourcePath}, which was not found in this export`,
        documentId,
      );
      continue;
    }

    const data = await input.readFile(attachmentSourcePath);
    const filename = path.posix.basename(raw.filePath);
    const hash = shortId("google-keep", documentId, String(index));

    const attachment: Attachment = {
      id: `google-keep:attachment:${hash}`,
      type: "attachment",
      filename,
      mediaType: raw.mimetype,
      size: data.length,
      checksum: checksum(data),
      localPath: `attachments/${hash}-${sanitizeFilenameSegment(filename)}`,
      source: { service: "google-keep", sourcePath: attachmentSourcePath },
    };

    attachmentBlobs?.set(attachment.id, data);
    attachments.push(attachment);
  }

  const labels = (note.labels ?? []).map((l) => l.name).filter((n): n is string => Boolean(n));

  const document: Document = {
    id: documentId,
    type: "document",
    title: note.title || undefined,
    format: "markdown",
    content: renderContent(note),
    createdAt: normalizeKeepTimestamp(note.createdTimestampUsec),
    updatedAt: normalizeKeepTimestamp(note.userEditedTimestampUsec),
    attachments: attachments.length > 0 ? attachments.map((a) => a.id) : undefined,
    source: { service: "google-keep", sourcePath: notePath },
    metadata: {
      googleKeep: {
        labels,
        color: note.color,
        isPinned: note.isPinned ?? false,
        isArchived: note.isArchived ?? false,
        isTrashed: note.isTrashed ?? false,
      },
    },
  };

  return { document, attachments };
}
