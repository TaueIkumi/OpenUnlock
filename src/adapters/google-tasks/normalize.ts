import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Collection, Document, Relation } from "../../core/canonical/types.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import type { GoogleTaskList } from "./parse-source.js";

export interface NormalizedTaskList {
  collection: Collection;
  documents: Document[];
  relations: Relation[];
}

function collectionId(listId: string): string {
  return `google-tasks:collection:${listId}`;
}

function documentId(taskId: string): string {
  return `google-tasks:document:${taskId}`;
}

export function normalizeTaskList(
  listPath: string,
  list: GoogleTaskList,
  diagnostics: DiagnosticCollector,
): NormalizedTaskList {
  const listId = list.id ?? listPath;
  const collId = collectionId(listId);

  const collection: Collection = {
    id: collId,
    type: "collection",
    title: list.title,
    updatedAt: normalizeTimestamp(list.updated),
    source: { service: "google-tasks", sourceId: list.id, sourcePath: listPath },
  };

  const tasks = list.items ?? [];
  const knownIds = new Set(tasks.map((t) => t.id).filter((id): id is string => Boolean(id)));

  const documents: Document[] = [];
  const relations: Relation[] = [];

  for (const task of tasks) {
    if (!task.id) {
      diagnostics.malformedSource("Task has no id; skipped", collId);
      continue;
    }

    const docId = documentId(task.id);

    if (!task.title) {
      diagnostics.malformedSource("Task has no title", docId);
    }

    documents.push({
      id: docId,
      type: "document",
      title: task.title || undefined,
      format: "text",
      content: task.notes ?? "",
      parentId: collId,
      updatedAt: normalizeTimestamp(task.updated),
      source: { service: "google-tasks", sourceId: task.id, sourcePath: listPath },
      metadata: {
        googleTasks: {
          status: task.status,
          due: normalizeTimestamp(task.due),
          completed: normalizeTimestamp(task.completed),
          deleted: task.deleted ?? false,
        },
      },
    });

    if (task.parent) {
      if (knownIds.has(task.parent)) {
        relations.push({
          id: `google-tasks:relation:sub-task-of:${task.id}:${task.parent}`,
          type: "relation",
          fromId: docId,
          toId: documentId(task.parent),
          relationKind: "sub-task-of",
          source: { service: "google-tasks" },
        });
      } else {
        diagnostics.missingReference(
          `Task references parent task ${task.parent}, which is not present in this list`,
          docId,
        );
      }
    }
  }

  return { collection, documents, relations };
}
