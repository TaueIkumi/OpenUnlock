import { z } from "zod";

/**
 * Runtime validation for canonical entities. Kept permissive on unknown
 * fields (see AGENT.md section 21: Forward Compatibility) — only fields
 * required for structural correctness are enforced.
 */

export const SCHEMA_VERSION = "1";

const entitySourceSchema = z.object({
  service: z.string().min(1),
  sourceId: z.string().optional(),
  sourcePath: z.string().optional(),
});

const baseEntitySchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  source: entitySourceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const workspaceSchema = baseEntitySchema.extend({
  type: z.literal("workspace"),
});

export const collectionSchema = baseEntitySchema.extend({
  type: z.literal("collection"),
  parentId: z.string().optional(),
});

export const documentSchema = baseEntitySchema.extend({
  type: z.literal("document"),
  content: z.string(),
  format: z.enum(["markdown", "text", "html"]),
  parentId: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  relations: z.array(z.string()).optional(),
});

export const conversationSchema = baseEntitySchema.extend({
  type: z.literal("conversation"),
  participantIds: z.array(z.string()).optional(),
  messageIds: z.array(z.string()),
});

export const messageSchema = baseEntitySchema.extend({
  type: z.literal("message"),
  conversationId: z.string().optional(),
  authorId: z.string().optional(),
  parentMessageId: z.string().optional(),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
});

export const personSchema = baseEntitySchema.extend({
  type: z.literal("person"),
  displayName: z.string().optional(),
  email: z.string().optional(),
});

export const attachmentSchema = baseEntitySchema.extend({
  type: z.literal("attachment"),
  filename: z.string().min(1),
  mediaType: z.string().optional(),
  size: z.number().optional(),
  checksum: z.string().optional(),
  localPath: z.string().min(1),
});

export const relationSchema = baseEntitySchema.extend({
  type: z.literal("relation"),
  fromId: z.string(),
  toId: z.string(),
  relationKind: z.string(),
});

export const canonicalEntitySchema = z.discriminatedUnion("type", [
  workspaceSchema,
  collectionSchema,
  documentSchema,
  conversationSchema,
  messageSchema,
  personSchema,
  attachmentSchema,
  relationSchema,
]);

export const archiveManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  openunlockVersion: z.string(),
  source: z.string(),
  entityCounts: z.record(z.string(), z.number()),
});

export type ArchiveManifest = z.infer<typeof archiveManifestSchema>;
