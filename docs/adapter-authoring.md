# Adapter Authoring Guide

Follow the workflow in AGENT.md section 23. This document covers the
mechanics specific to this codebase.

## Contract

Implement `SourceAdapter` from `src/core/adapter.ts`:

```ts
interface SourceAdapter {
  id: string;
  displayName: string;
  detect(input: InputSource): Promise<DetectionResult>;
  inspect(input: InputSource): Promise<InspectionResult>;
  parse(input: InputSource, context: AdapterContext): AsyncIterable<AnyCanonicalEntity>;
}
```

`InputSource` (from `src/core/input.ts`) abstracts over a zip archive or an
already-extracted directory. Never touch the filesystem or archive
directly from adapter code — always go through `InputSource`, so path
safety (zip slip, traversal) is enforced in one place.

## Steps

1. **Structure, not filenames.** `detect()` should read enough of the input
   to confirm structural markers (e.g. a specific top-level file with an
   expected shape), and return a `confidence` in `[0, 1]` with `evidence`
   strings explaining the score.
2. **Parse without rendering.** `parse()` is an async generator that yields
   `AnyCanonicalEntity` values. It must never produce Markdown or any other
   destination-specific output — that's the exporter's job.
3. **Normalize, don't guess.** Map source semantics onto canonical fields.
   Anything without a canonical equivalent goes into
   `metadata.<yourAdapterId>`.
4. **Never drop data silently.** Use `context.diagnostics` (a
   `DiagnosticCollector`) to report anything unsupported, malformed, or
   lossy. See `src/core/diagnostics.ts` for the categories.
5. **Fixtures are mandatory.** Add synthetic, minimal, legally
   redistributable fixtures under `src/adapters/<id>/fixtures/`. Follow the
   ChatGPT adapter's layout: `basic/`, a branching/edge-case fixture,
   `attachments/` (if applicable), `malformed/`, `unknown-fields/`.
6. **Tests are mandatory** (AGENT.md section 20): detection tests, parsing
   tests, normalization tests, malformed-input tests, and at least one
   integration/golden-output test under `test/integration/`.

## Cross-entity links

If your source has internal links between pages/documents (Notion page
links, Slack message permalinks, etc.), emit them in Markdown-formatted
`content` as a normal link whose href is `openunlock://entity/<canonical-id>`
of the target entity, and list the target in the entity's `relations`
field. This is a generic convention — not source-specific — so exporters
can resolve it without knowing anything about your adapter. The `markdown`
exporter (`src/exporters/markdown/render.ts`, `resolveEntityLinks`)
resolves these to relative paths between the generated files at export
time, and reports a `missing-reference` diagnostic for any link whose
target wasn't included in the export.

## Reference implementations

`src/adapters/chatgpt/` is the reference adapter for a single well-known
JSON export format:

- `detect.ts` — structural detection of `conversations.json`
- `parse-source.ts` — loosely-typed raw export shapes
- `normalize.ts` — pure functions mapping raw conversations to canonical
  `Conversation` / `Message` / `Person` entities, preserving branching via
  `parentMessageId`
- `parse.ts` — the adapter's async generator, wiring normalization to the
  `SourceAdapter.parse` contract
- `inspect.ts` — lightweight structural summary for `openunlock inspect`

`src/adapters/notion/` is the reference adapter for a filesystem-shaped
export (nested directories, cross-file links, and a secondary format —
CSV — living alongside Markdown):

- `parse-source.ts` — filename-pattern parsing (`<Title> <32-hex-id>`) and
  parent-directory resolution
- `csv.ts` — a small dependency-free CSV parser for database exports
- `normalize.ts` — page and database normalization, including the
  `openunlock://entity/` link rewriting described above
- `parse.ts` — walks every file in the export exactly once, in a stable
  (sorted) order from `InputSource.listFiles()`
