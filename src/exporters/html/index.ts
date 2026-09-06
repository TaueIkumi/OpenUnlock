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
import { groupById } from "../markdown/render.js";
import { escapeHtml, renderConversationBody, renderDocumentBody, renderPage } from "./render.js";

function renderIndexPage(
  conversations: { title: string; href: string }[],
  documents: { title: string; href: string }[],
): string {
  const list = (items: { title: string; href: string }[]): string =>
    items.length === 0
      ? "<p><em>none</em></p>"
      : `<ul>\n${items
          .map((i) => `<li><a href="${escapeHtml(i.href)}">${escapeHtml(i.title)}</a></li>`)
          .join("\n")}\n</ul>`;

  return (
    `<h1>OpenUnlock Archive</h1>\n` +
    `<h2>Conversations</h2>\n${list(conversations)}\n` +
    `<h2>Documents</h2>\n${list(documents)}`
  );
}

/**
 * A browsable, fully offline static site: one HTML page per
 * conversation/document, a top-level index linking to all of them, and
 * real (sanitized) hyperlinks/embeds between pages via the generic
 * openunlock://entity/<id> scheme. No external stylesheet or script is
 * loaded — everything needed to view the archive is in the files
 * themselves (AGENT.md section 2.1, Local-first).
 */
export const htmlArchiveExporter: Exporter = {
  id: "html",

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

    const outputPathById = new Map<string, string>();

    for (const conversation of conversations) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(conversation.createdAt),
        title: conversation.title,
        shortId: shortId(conversation.source.service, conversation.id),
        extension: "html",
      });
      outputPathById.set(conversation.id, `conversations/${filename}`);
    }
    for (const document of documents) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(document.createdAt),
        title: document.title,
        shortId: shortId(document.source.service, document.id),
        extension: "html",
      });
      outputPathById.set(document.id, `documents/${filename}`);
    }
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
      const body = renderConversationBody(conversation, messagesById, peopleById);
      await writeTextFile(context, outputPath, renderPage(conversation.title ?? "Untitled", body));
      filesWritten++;
    }

    for (const document of documents) {
      const outputPath = outputPathById.get(document.id)!;
      const body = renderDocumentBody(
        document,
        (id) => resolveRelativeLink(outputPath, id),
        (id) =>
          context.diagnostics.missingReference(
            `Link target not included in this export: ${id}`,
            document.id,
          ),
      );
      await writeTextFile(context, outputPath, renderPage(document.title ?? "Untitled", body));
      filesWritten++;
    }

    for (const attachment of attachmentsWithBlobs) {
      const blob = context.attachmentBlobs!.get(attachment.id)!;
      await writeBinaryFile(context, attachment.localPath, blob);
      filesWritten++;
    }

    const indexHtml = renderPage(
      "OpenUnlock Archive",
      renderIndexPage(
        conversations.map((c) => ({
          title: c.title ?? "Untitled",
          href: outputPathById.get(c.id)!,
        })),
        documents.map((d) => ({ title: d.title ?? "Untitled", href: outputPathById.get(d.id)! })),
      ),
    );
    await writeTextFile(context, "index.html", indexHtml);
    filesWritten++;

    await writeJsonFile(context, "openunlock.json", manifest);
    await writeJsonFile(context, "diagnostics.json", serializeDiagnostics(context.diagnostics.all()));
    filesWritten += 2;

    return { filesWritten, entityCounts };
  },
};
