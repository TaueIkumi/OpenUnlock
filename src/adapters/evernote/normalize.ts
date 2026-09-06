import { createHash } from "node:crypto";
import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { AttachmentBlobStore } from "../../core/attachment-blobs.js";
import type { Attachment, Collection, Document, Person } from "../../core/canonical/types.js";
import { checksum, shortId } from "../../utils/hashing.js";
import { sanitizeFilenameSegment, slugify } from "../../utils/filenames.js";
import { normalizeEvernoteTimestamp } from "./parse-source.js";
import type { EvernoteExport, EvernoteResource } from "./parse-source.js";

export interface NormalizedExport {
  collection: Collection;
  documents: Document[];
  attachments: Attachment[];
  people: Person[];
}

/** `<en-media hash="..." type="..."/>`, Evernote's inline reference to a <resource>. */
const EN_MEDIA_PATTERN = /<en-media\b[^>]*\bhash="([0-9a-fA-F]{32})"[^>]*\/?>/g;

/**
 * MD5 of the resource's decoded bytes — the identifier Evernote itself uses
 * to link an <en-media> tag in note content back to its <resource>. Not a
 * security use of MD5, just matching the source format's own convention.
 */
function resourceHash(data: Buffer): string {
  return createHash("md5").update(data).digest("hex");
}

function extensionForMime(mime: string | undefined): string {
  const subtype = mime?.split("/")[1];
  return subtype ? `.${subtype.split("+")[0]}` : "";
}

export function normalizeExport(
  notebookFile: string,
  raw: EvernoteExport,
  diagnostics: DiagnosticCollector,
  attachmentBlobs?: AttachmentBlobStore,
): NormalizedExport {
  const notebookTitle = notebookFile.split("/").pop()!.replace(/\.enex$/i, "");
  const collectionId = `evernote:collection:${shortId("evernote", notebookFile)}`;

  const collection: Collection = {
    id: collectionId,
    type: "collection",
    title: notebookTitle,
    source: { service: "evernote", sourcePath: notebookFile },
    metadata: raw.exportDate ? { evernote: { exportDate: raw.exportDate } } : undefined,
  };

  const peopleById = new Map<string, Person>();
  const documents: Document[] = [];
  const attachments: Attachment[] = [];

  raw.notes.forEach((note, noteIndex) => {
    const documentId = `evernote:document:${shortId(
      "evernote",
      notebookFile,
      note.title ?? "",
      note.created ?? "",
      String(noteIndex),
    )}`;

    let authorId: string | undefined;
    if (note.author) {
      authorId = `evernote:person:${shortId("evernote", slugify(note.author))}`;
      if (!peopleById.has(authorId)) {
        peopleById.set(authorId, {
          id: authorId,
          type: "person",
          displayName: note.author,
          source: { service: "evernote" },
        });
      }
    }

    if (!note.created) {
      diagnostics.malformedSource("Note is missing <created>", documentId);
    }

    const resourceByHash = new Map<string, Attachment>();
    const noteAttachments: Attachment[] = [];

    note.resources.forEach((resource: EvernoteResource, resourceIndex) => {
      if (!resource.data) {
        diagnostics.unsupported(`Resource ${resourceIndex} has no data payload`, documentId);
        return;
      }

      const hash = shortId("evernote", documentId, String(resourceIndex));
      const filename =
        resource.fileName ?? `resource-${resourceIndex}${extensionForMime(resource.mime)}`;

      const attachment: Attachment = {
        id: `evernote:attachment:${hash}`,
        type: "attachment",
        filename,
        mediaType: resource.mime,
        size: resource.data.length,
        checksum: checksum(resource.data),
        localPath: `attachments/${hash}-${sanitizeFilenameSegment(filename)}`,
        source: { service: "evernote", sourcePath: notebookFile },
      };

      attachmentBlobs?.set(attachment.id, resource.data);
      resourceByHash.set(resourceHash(resource.data), attachment);
      noteAttachments.push(attachment);
    });

    const content = note.contentHtml.replace(EN_MEDIA_PATTERN, (full, mediaHash: string) => {
      const attachment = resourceByHash.get(mediaHash.toLowerCase());
      if (!attachment) {
        diagnostics.missingReference(
          `<en-media> references resource hash ${mediaHash}, which was not found among this note's resources`,
          documentId,
        );
        return full;
      }
      return `![${attachment.filename}](openunlock://entity/${attachment.id})`;
    });

    attachments.push(...noteAttachments);

    documents.push({
      id: documentId,
      type: "document",
      title: note.title,
      format: "html",
      content,
      parentId: collectionId,
      createdAt: normalizeEvernoteTimestamp(note.created),
      updatedAt: normalizeEvernoteTimestamp(note.updated),
      attachments: noteAttachments.length > 0 ? noteAttachments.map((a) => a.id) : undefined,
      source: { service: "evernote", sourcePath: notebookFile },
      metadata: {
        evernote: {
          tags: note.tags,
          author: note.author,
          sourceUrl: note.sourceUrl,
        },
      },
    });
  });

  return { collection, documents, attachments, people: Array.from(peopleById.values()) };
}
