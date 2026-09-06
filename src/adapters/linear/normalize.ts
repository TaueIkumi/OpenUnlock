import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Collection, Document, Person, Relation } from "../../core/canonical/types.js";
import type { CsvTable } from "../../utils/csv.js";
import { normalizeTimestamp } from "../../utils/dates.js";
import { slugify } from "../../utils/filenames.js";
import { findColumn } from "./parse-source.js";

export interface NormalizedExport {
  collections: Collection[];
  documents: Document[];
  people: Person[];
  relations: Relation[];
}

function documentId(issueId: string): string {
  return `linear:document:${issueId}`;
}

function teamCollectionId(teamName: string): string {
  return `linear:collection:${slugify(teamName)}`;
}

function personId(name: string): string {
  return `linear:person:${slugify(name)}`;
}

export function normalizeExport(table: CsvTable, diagnostics: DiagnosticCollector): NormalizedExport {
  const collectionsByTeam = new Map<string, Collection>();
  const peopleByName = new Map<string, Person>();
  const documents: Document[] = [];
  const relations: Relation[] = [];
  const knownIds = new Set<string>();

  for (const row of table.rows) {
    const id = findColumn(row, "id");
    if (id) knownIds.add(id);
  }

  for (const row of table.rows) {
    const id = findColumn(row, "id");
    if (!id) {
      diagnostics.malformedSource("Row has no id-shaped value in an id column; skipped");
      continue;
    }

    const docId = documentId(id);
    const teamName = findColumn(row, "team");
    let parentId: string | undefined;
    if (teamName) {
      const collectionId = teamCollectionId(teamName);
      if (!collectionsByTeam.has(collectionId)) {
        collectionsByTeam.set(collectionId, {
          id: collectionId,
          type: "collection",
          title: teamName,
          source: { service: "linear" },
        });
      }
      parentId = collectionId;
    }

    const assignee = findColumn(row, "assignee");
    if (assignee) {
      const pId = personId(assignee);
      if (!peopleByName.has(pId)) {
        peopleByName.set(pId, {
          id: pId,
          type: "person",
          displayName: assignee,
          source: { service: "linear" },
        });
      }
    }

    const createdAt = normalizeTimestamp(findColumn(row, "created"));
    if (findColumn(row, "created") && !createdAt) {
      diagnostics.malformedSource(`Row ${id} has an unparseable "Created" timestamp`, docId);
    }

    const labels = (findColumn(row, "labels") ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    documents.push({
      id: docId,
      type: "document",
      title: findColumn(row, "title") ?? id,
      format: "markdown",
      content: findColumn(row, "description") ?? "",
      parentId,
      createdAt,
      updatedAt: normalizeTimestamp(findColumn(row, "updated")),
      source: { service: "linear", sourceId: id, sourcePath: findColumn(row, "url") },
      metadata: {
        linear: {
          status: findColumn(row, "status"),
          priority: findColumn(row, "priority"),
          assignee,
          labels,
          cycle: findColumn(row, "cycle"),
          project: findColumn(row, "project"),
        },
      },
    });

    const parentIssueId = findColumn(row, "parent");
    if (parentIssueId) {
      if (knownIds.has(parentIssueId)) {
        relations.push({
          id: `linear:relation:sub-issue-of:${id}:${parentIssueId}`,
          type: "relation",
          fromId: docId,
          toId: documentId(parentIssueId),
          relationKind: "sub-issue-of",
          source: { service: "linear" },
        });
      } else {
        diagnostics.missingReference(
          `Issue ${id} references parent issue ${parentIssueId}, which is not present in this export`,
          docId,
        );
      }
    }
  }

  return {
    collections: Array.from(collectionsByTeam.values()),
    documents,
    people: Array.from(peopleByName.values()),
    relations,
  };
}
