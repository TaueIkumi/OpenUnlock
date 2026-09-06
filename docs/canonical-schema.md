# Canonical Schema (v1)

The canonical model is the architectural boundary between adapters (source
parsing) and exporters (output rendering). See `src/core/canonical/types.ts`
for the TypeScript types and `src/core/canonical/schema.ts` for the runtime
(Zod) validation.

## Entity types

- `workspace`
- `collection`
- `document`
- `conversation`
- `message`
- `person`
- `attachment`
- `relation`

## Base fields

Every entity has:

```ts
interface CanonicalEntity {
  id: string;
  type: string;
  title?: string;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  source: { service: string; sourceId?: string; sourcePath?: string };
  metadata?: Record<string, unknown>;
}
```

Timestamps are always normalized to ISO 8601 UTC via `src/utils/dates.ts`.
A timestamp that cannot be parsed is omitted (never guessed) and reported as
a `malformed-source` diagnostic.

## Source-specific data

Anything that doesn't map to a canonical field is preserved under a
namespaced key in `metadata`, e.g. `metadata.chatgpt`. This keeps the core
schema generic while ensuring no source data is silently discarded
(AGENT.md section 2.3, Preserve before transforming).

## Schema versioning

`schemaVersion` in the archive manifest (`openunlock.json`) is versioned
independently of the npm package version (AGENT.md section 22). Breaking
changes to the canonical model require a new schema version; additive,
backward-compatible changes may stay within the current version.
