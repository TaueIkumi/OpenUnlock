/**
 * SQLite schema for the canonical model. One table per canonical entity
 * type, mirroring the "one type per directory" layout of the filesystem
 * exporter. Array-valued fields (Document.attachments/relations,
 * Conversation.participantIds/messageIds, Message.attachments) are stored
 * as JSON text columns rather than join tables — a deliberate MVP
 * simplification; querying them needs SQLite's `json_each()`, not a JOIN.
 *
 * This schema is versioned by `SCHEMA_VERSION` (see canonical/schema.ts),
 * recorded in the `openunlock_manifest` table, same as every other
 * exporter's `openunlock.json`.
 */
export const CREATE_TABLES_SQL = `
CREATE TABLE openunlock_manifest (
  schema_version TEXT NOT NULL,
  openunlock_version TEXT NOT NULL,
  source TEXT NOT NULL,
  entity_counts_json TEXT NOT NULL
);

CREATE TABLE diagnostic (
  seq INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  ref TEXT
);

CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT
);

CREATE TABLE collection (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  parent_id TEXT
);

CREATE TABLE document (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  content TEXT NOT NULL,
  format TEXT NOT NULL,
  parent_id TEXT,
  attachments_json TEXT,
  relations_json TEXT
);

CREATE TABLE conversation (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  participant_ids_json TEXT,
  message_ids_json TEXT NOT NULL
);

CREATE TABLE message (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  conversation_id TEXT,
  author_id TEXT,
  parent_message_id TEXT,
  content TEXT NOT NULL,
  attachments_json TEXT
);

CREATE TABLE person (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  display_name TEXT,
  email TEXT
);

CREATE TABLE attachment (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  filename TEXT NOT NULL,
  media_type TEXT,
  size INTEGER,
  checksum TEXT,
  local_path TEXT NOT NULL
);

CREATE TABLE relation (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT,
  updated_at TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  source_path TEXT,
  metadata_json TEXT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation_kind TEXT NOT NULL
);
`;
