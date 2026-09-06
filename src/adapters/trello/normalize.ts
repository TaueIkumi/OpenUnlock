import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type {
  Collection,
  Document,
  Message,
  Person,
  Relation,
  Workspace,
} from "../../core/canonical/types.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import { timestampFromObjectId, type TrelloBoard, type TrelloChecklist } from "./parse-source.js";

export interface NormalizedBoard {
  workspace: Workspace;
  collections: Collection[];
  documents: Document[];
  people: Person[];
  messages: Message[];
  relations: Relation[];
}

const workspaceId = (boardId: string): string => `trello:workspace:${boardId}`;
const collectionId = (listId: string): string => `trello:collection:${listId}`;
const documentId = (cardId: string): string => `trello:document:${cardId}`;
const personId = (memberId: string): string => `trello:person:${memberId}`;
const messageId = (actionId: string): string => `trello:message:${actionId}`;
const relationId = (kind: string, fromId: string, toId: string): string =>
  `trello:relation:${kind}:${fromId}:${toId}`;

function renderChecklist(checklist: TrelloChecklist): string {
  const lines = [`**${checklist.name}**`];
  for (const item of checklist.checkItems ?? []) {
    const box = item.state === "complete" ? "x" : " ";
    lines.push(`- [${box}] ${item.name}`);
  }
  return lines.join("\n");
}

export function normalizeBoard(raw: TrelloBoard, diagnostics: DiagnosticCollector): NormalizedBoard {
  const wsId = workspaceId(raw.id);
  const workspace: Workspace = {
    id: wsId,
    type: "workspace",
    title: raw.name,
    createdAt: timestampFromObjectId(raw.id),
    source: { service: "trello", sourceId: raw.id },
    metadata: { trello: { desc: raw.desc, closed: raw.closed ?? false, url: raw.url } },
  };

  const lists = raw.lists ?? [];
  const listIds = new Set(lists.map((l) => l.id));
  const collections: Collection[] = lists.map((list) => ({
    id: collectionId(list.id),
    type: "collection",
    title: list.name,
    createdAt: timestampFromObjectId(list.id),
    parentId: wsId,
    source: { service: "trello", sourceId: list.id },
    metadata: { trello: { closed: list.closed ?? false } },
  }));

  const members = raw.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const people: Person[] = members.map((member) => ({
    id: personId(member.id),
    type: "person",
    displayName: member.fullName ?? member.username ?? member.id,
    createdAt: timestampFromObjectId(member.id),
    source: { service: "trello", sourceId: member.id },
    metadata: { trello: { username: member.username } },
  }));

  const documents: Document[] = [];
  const relations: Relation[] = [];
  const cardIds = new Set<string>();

  for (const card of raw.cards ?? []) {
    cardIds.add(card.id);
    const docId = documentId(card.id);

    if (!listIds.has(card.idList)) {
      diagnostics.missingReference(
        `Card "${card.name}" references list ${card.idList}, which is not present in this export`,
        docId,
      );
    }

    const cardChecklists = (raw.checklists ?? []).filter((c) => c.idCard === card.id);
    const contentParts = [card.desc ?? "", ...cardChecklists.map(renderChecklist)];
    const content = contentParts.filter((p) => p.length > 0).join("\n\n");

    if (card.attachments && card.attachments.length > 0) {
      diagnostics.lossyConversion(
        `${card.attachments.length} attachment(s) referenced but not copied ` +
          `(Trello's JSON export does not include attachment bytes)`,
        docId,
      );
    }

    documents.push({
      id: docId,
      type: "document",
      title: card.name,
      format: "markdown",
      content,
      parentId: listIds.has(card.idList) ? collectionId(card.idList) : undefined,
      createdAt: timestampFromObjectId(card.id),
      updatedAt: normalizeTimestamp(card.dateLastActivity ?? undefined),
      source: { service: "trello", sourceId: card.id, sourcePath: card.shortUrl ?? card.url },
      metadata: {
        trello: {
          closed: card.closed ?? false,
          due: card.due ?? null,
          labels: (card.labels ?? []).map((l) => l.name).filter((n): n is string => Boolean(n)),
          idMembers: card.idMembers ?? [],
          ...(card.attachments && card.attachments.length > 0
            ? { attachments: card.attachments.map((a) => ({ name: a.name, url: a.url })) }
            : {}),
        },
      },
    });

    for (const memberId of card.idMembers ?? []) {
      if (!memberIds.has(memberId)) {
        diagnostics.missingReference(
          `Card "${card.name}" is assigned to member ${memberId}, who is not present in this export`,
          docId,
        );
        continue;
      }
      relations.push({
        id: relationId("assigned-to", docId, personId(memberId)),
        type: "relation",
        fromId: docId,
        toId: personId(memberId),
        relationKind: "assigned-to",
        source: { service: "trello" },
      });
    }
  }

  const messages: Message[] = [];
  let unsupportedActionCount = 0;

  for (const action of raw.actions ?? []) {
    if (action.type !== "commentCard") {
      unsupportedActionCount++;
      continue;
    }

    const cardRef = action.data?.card?.id;
    if (!cardRef || !cardIds.has(cardRef)) {
      diagnostics.missingReference(
        `Comment references card ${cardRef ?? "(unknown)"}, which is not present in this export`,
        messageId(action.id),
      );
      continue;
    }

    let authorId: string | undefined;
    if (action.idMemberCreator) {
      if (memberIds.has(action.idMemberCreator)) {
        authorId = personId(action.idMemberCreator);
      } else {
        diagnostics.missingReference(
          `Comment author ${action.idMemberCreator} is not present in this export's members`,
          messageId(action.id),
        );
      }
    }

    const msgId = messageId(action.id);
    messages.push({
      id: msgId,
      type: "message",
      authorId,
      content: action.data?.text ?? "",
      createdAt: normalizeTimestamp(action.date),
      source: { service: "trello", sourceId: action.id },
      metadata: { trello: { actionType: action.type } },
    });

    relations.push({
      id: relationId("comment-on", msgId, documentId(cardRef)),
      type: "relation",
      fromId: msgId,
      toId: documentId(cardRef),
      relationKind: "comment-on",
      source: { service: "trello" },
    });
  }

  if (unsupportedActionCount > 0) {
    diagnostics.unsupported(
      `${unsupportedActionCount} board activity event(s) (non-comment actions) are not converted to canonical entities`,
      wsId,
    );
  }

  return { workspace, collections, documents, people, messages, relations };
}
