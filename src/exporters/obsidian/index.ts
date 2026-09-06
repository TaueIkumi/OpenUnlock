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
import { groupById, renderConversationMarkdown, renderDocumentMarkdown } from "../markdown/render.js";

/**
 * Same `openunlock://entity/<id>` scheme every adapter can emit, but
 * resolved to Obsidian's own link syntax instead of a relative path:
 * `[[filename|label]]` for a link to another note, `![[filename]]` for an
 * embed (the source markup had a leading `!`, e.g. an image). Unlike a
 * relative-path link, a wikilink survives the vault being reorganized
 * into different folders later — which is the whole reason Obsidian users
 * favor it.
 */
const ENTITY_LINK_MARKUP_PATTERN = /(!?)\[([^\]]*)\]\(openunlock:\/\/entity\/([^\s)]+)\)/g;

export const obsidianExporter: Exporter = {
  id: "obsidian",

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

    // Every linkable entity's vault filename (no folder, no extension) —
    // wikilinks resolve by name across the whole vault, not by relative
    // path, so there's no need to track each note's directory the way the
    // markdown exporter does for its relative links.
    const vaultFilenameById = new Map<string, string>();

    for (const conversation of conversations) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(conversation.createdAt),
        title: conversation.title,
        shortId: shortId(conversation.source.service, conversation.id),
        extension: "md",
      });
      vaultFilenameById.set(conversation.id, filename.replace(/\.md$/, ""));
    }
    for (const document of documents) {
      const filename = buildDeterministicFilename({
        date: isoDatePart(document.createdAt),
        title: document.title,
        shortId: shortId(document.source.service, document.id),
        extension: "md",
      });
      vaultFilenameById.set(document.id, filename.replace(/\.md$/, ""));
    }
    const attachmentsWithBlobs = attachments.filter((a) => context.attachmentBlobs?.get(a.id));
    for (const attachment of attachmentsWithBlobs) {
      vaultFilenameById.set(attachment.id, attachment.localPath.split("/").pop()!);
    }

    const resolveWikilink = (sourceEntityId: string) => (content: string): string =>
      content.replace(ENTITY_LINK_MARKUP_PATTERN, (full, bang: string, label: string, id: string) => {
        const target = vaultFilenameById.get(id);
        if (!target) {
          context.diagnostics.missingReference(`Link target not included in this export: ${id}`, sourceEntityId);
          return full;
        }
        return bang === "!" ? `![[${target}]]` : `[[${target}|${label}]]`;
      });

    let filesWritten = 0;

    for (const conversation of conversations) {
      const filename = vaultFilenameById.get(conversation.id)! + ".md";
      const markdown = renderConversationMarkdown(conversation, messagesById, peopleById);
      await writeTextFile(context, `conversations/${filename}`, resolveWikilink(conversation.id)(markdown));
      filesWritten++;
    }

    for (const document of documents) {
      const filename = vaultFilenameById.get(document.id)! + ".md";
      const resolvedContent = resolveWikilink(document.id)(document.content);
      const markdown = renderDocumentMarkdown(document, resolvedContent);
      await writeTextFile(context, `documents/${filename}`, markdown);
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
