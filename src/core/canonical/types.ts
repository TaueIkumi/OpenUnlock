/**
 * Canonical entity model. Adapters emit these; exporters consume only these.
 * See AGENT.md section 7 for the architectural rationale.
 */

export type CanonicalEntityType =
  | "workspace"
  | "collection"
  | "document"
  | "conversation"
  | "message"
  | "person"
  | "attachment"
  | "relation";

export interface EntitySource {
  service: string;
  sourceId?: string;
  sourcePath?: string;
}

export interface CanonicalEntity {
  id: string;
  type: CanonicalEntityType;

  title?: string;

  createdAt?: string;
  updatedAt?: string;

  source: EntitySource;

  metadata?: Record<string, unknown>;
}

export interface Workspace extends CanonicalEntity {
  type: "workspace";
}

export interface Collection extends CanonicalEntity {
  type: "collection";
  parentId?: string;
}

export interface Document extends CanonicalEntity {
  type: "document";
  content: string;
  format: "markdown" | "text" | "html";
  parentId?: string;
  attachments?: string[];
  relations?: string[];
}

export interface Conversation extends CanonicalEntity {
  type: "conversation";
  participantIds?: string[];
  messageIds: string[];
}

export interface Message extends CanonicalEntity {
  type: "message";
  conversationId?: string;
  authorId?: string;
  parentMessageId?: string;
  content: string;
  attachments?: string[];
}

export interface Person extends CanonicalEntity {
  type: "person";
  displayName?: string;
  email?: string;
}

export interface Attachment extends CanonicalEntity {
  type: "attachment";
  filename: string;
  mediaType?: string;
  size?: number;
  checksum?: string;
  localPath: string;
}

export interface Relation extends CanonicalEntity {
  type: "relation";
  fromId: string;
  toId: string;
  relationKind: string;
}

export type AnyCanonicalEntity =
  | Workspace
  | Collection
  | Document
  | Conversation
  | Message
  | Person
  | Attachment
  | Relation;
