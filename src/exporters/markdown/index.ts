import path from "node:path";
import type { Exporter, ExportContext, ExportResult } from "../../core/exporter.js";
import type {
  Attachment,
  AnyCanonicalEntity,
  Conversation,
  Document,
  Message,
  Person,
} from "../../core/canonical/types.js";
import { buildDeterministicFilename } from "../../utils/filenames.js";
import { shortId } from "../../utils/hashing.js";
import { isoDatePart } from "../../utils/dates.js";
import {
  buildManifest,
  countByType,
  ensureOutputDir,
  serializeDiagnostics,
  sortEntitiesDeterministically,
  writeBinaryFile,
  writeJsonFile,
  writeTextFile,
} from "../shared.js";
import {
  groupById,
  renderConversationMarkdown,
  renderDocumentMarkdown,
  resolveEntityLinks,
} from "./render.js";

export const markdownExporter: Exporter = {
  id: "markdown",

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

    const conversations = sorted.filter((e): e is Conversation => e.type === "conversation");
    const documents = sorted.filter((e): e is Document => e.type === "document");
    const messages = sorted.filter((e): e is Message => e.type === "message");
    const people = sorted.filter((e): e is Person => e.type === "person");
    const attachments = sorted.filter((e): e is Attachment => e.type === "attachment");

    const messagesById = groupById(messages);
    const peopleById = groupById(people);

    // Pass 1: compute every conversation/document's output path up front, so
    // links between them (openunlock://entity/<id>) can be resolved to
    // relative paths in pass 2, regardless of write order.
    const outputPathById = new Map<string, string>();

    for (const conversation of conversations) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(conversation.createdAt),
        title: conversation.title,
        shortId: shortId(conversation.source.service, conversation.id),
        extension: "md",
      });
      outputPathById.set(conversation.id, `conversations/${filename}`);
    }
    for (const document of documents) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(document.createdAt),
        title: document.title,
        shortId: shortId(document.source.service, document.id),
        extension: "md",
      });
      outputPathById.set(document.id, `documents/${filename}`);
    }
    // Only register an attachment's output path when its bytes are actually
    // available to copy (see AttachmentBlobStore) — most adapters only know
    // an attachment by metadata, and a link to one should be reported as
    // unresolved (not silently pointed at a file that doesn't exist here).
    const attachmentsWithBlobs = attachments.filter((a) => context.attachmentBlobs?.get(a.id));
    for (const attachment of attachmentsWithBlobs) {
      outputPathById.set(attachment.id, attachment.localPath);
    }

    const resolveRelativeLink = (fromOutputPath: string, targetId: string): string | undefined => {
      const targetPath = outputPathById.get(targetId);
      if (!targetPath) return undefined;
      const relative = path.posix.relative(path.posix.dirname(fromOutputPath), targetPath);
      return relative.startsWith(".") ? relative : `./${relative}`;
    };

    let filesWritten = 0;

    for (const conversation of conversations) {
      const outputPath = outputPathById.get(conversation.id)!;
      const markdown = renderConversationMarkdown(conversation, messagesById, peopleById);
      await writeTextFile(context, outputPath, markdown);
      filesWritten++;
    }

    for (const document of documents) {
      const outputPath = outputPathById.get(document.id)!;
      const resolvedContent = resolveEntityLinks(
        document.content,
        (id) => resolveRelativeLink(outputPath, id),
        (id) =>
          context.diagnostics.missingReference(
            `Link target not included in this export: ${id}`,
            document.id,
          ),
      );
      const markdown = renderDocumentMarkdown(document, resolvedContent);
      await writeTextFile(context, outputPath, markdown);
      filesWritten++;
    }

    for (const attachment of attachmentsWithBlobs) {
      const blob = context.attachmentBlobs!.get(attachment.id)!;
      await writeBinaryFile(context, attachment.localPath, blob);
      filesWritten++;
    }

    await writeJsonFile(context, "openunlock.json", manifest);
    await writeJsonFile(context, "diagnostics.json", serializeDiagnostics(context.diagnostics.all()));
    filesWritten += 2;

    return { filesWritten, entityCounts };
  },
};
