# Format Compatibility

## ChatGPT

**Accepted input:** Official ChatGPT "Export data" account export ZIP (or
the extracted directory), specifically `conversations.json`.

**Supported:**

- ✓ conversations and messages (linear and branching)
- ✓ timestamps (normalized to ISO 8601)
- ✓ author roles (user / assistant / system) as `Person` entities
- ✓ unknown/future top-level conversation fields (preserved in
  `metadata.chatgpt.extraFields`)
- ✓ reasoning-model content (`thoughts` and `reasoning_recap` content
  types, used by o1/o3-style extended thinking — undocumented by OpenAI,
  found by running this adapter against a real export). A `thoughts`
  message's chain-of-thought steps are joined into readable text (each
  step's full content, falling back to its one-line summary); the raw
  shape is still kept in `metadata.chatgpt.rawContent` as a safety net.
  Before this, these accounted for as much as **half the messages** in a
  real reasoning-heavy export, all silently reduced to an empty,
  "unsupported" placeholder.

**Partially supported:**

- △ branching conversation metadata — all branches are preserved as
  `Message` entities with `parentMessageId`, but only `current_node` is
  recorded; reconstructing which branch was "selected" for a leaf beyond
  that requires reading `metadata.chatgpt.currentNode` on the conversation.

**Unsupported (reported as diagnostics, not dropped):**

- ✗ multimodal content (images, files) — the message is preserved as an
  empty-content `Message` with `metadata.chatgpt.rawContent` holding the
  original content object, and a `diagnostics.json` entry with category
  `unsupported`.
- ✗ attachments are not yet extracted as canonical `Attachment` entities.

## Claude

**Accepted input:** Official Claude.ai "Export data" account export ZIP
(or the extracted directory), specifically `conversations.json`. This
happens to be the same filename ChatGPT uses, but a completely different
schema — detection keys off the `chat_messages` field (Claude) versus
`mapping` (ChatGPT), which never collide in practice, so both adapters can
coexist without ambiguity.

**Supported:**

- ✓ conversations and messages — Claude's export is already a flat,
  linear list per conversation (no branch reconstruction needed, unlike
  ChatGPT's tree-shaped `mapping`)
- ✓ timestamps (normalized to ISO 8601)
- ✓ human/assistant authorship as `Person` entities
- ✓ unknown/future top-level conversation fields (preserved in
  `metadata.claude.extraFields`)

**Partially supported:**

- △ message content blocks other than `{"type": "text"}` (e.g. tool use)
  are reported as `unsupported`; the message becomes an empty-content
  `Message`, with the raw block data preserved in the diagnostic, not in
  metadata (Claude's export doesn't nest arbitrary raw content the way
  ChatGPT's does).

**Unsupported:**

- ✗ attachments/files are detected and reported (`lossy-conversion`) but
  not extracted as canonical `Attachment` entities — the export doesn't
  include their bytes.

## Notion

**Accepted input:** Official Notion "Export as Markdown & CSV" ZIP (or the
extracted directory) for a workspace, page, or subset of pages. Every
exported page/database file follows the pattern `<Title> <32-hex-id>.md` /
`.csv`, and nested pages are exported as a sibling directory sharing the
parent file's base name.

**Supported:**

- ✓ pages as `Document` entities, hierarchy reconstructed from the export's
  directory nesting (`parentId`)
- ✓ databases (CSV) as a `Collection` entity, with one `Document` per row
- ✓ internal page-to-page links, rewritten during Markdown export to a
  correct relative path between the generated files (AGENT.md section 12,
  Relationship Preservation)
- ✓ unresolved links (pointing to a page not included in this export)
  reported as `missing-reference` diagnostics rather than silently broken

**Partially supported:**

- △ attachments (images, files) — detected and modeled as `Attachment`
  entities referencing their original path in the source export, but their
  bytes are not copied into the converted output yet. Reported as a
  `lossy-conversion` diagnostic per attachment.
- △ database rows are identified by CSV row order
  (`<collection-id>:row-<index>`), not a stable Notion page id — CSV
  exports don't carry one. Reordering rows between exports will change
  row ids.
- △ if a database was exported with "include content" (producing both a
  CSV and per-row page files), the CSV rows and the per-row `.md` pages are
  parsed independently; they are not correlated into a single entity.

**Unsupported:**

- ✗ Notion-specific block types beyond plain Markdown (e.g. synced blocks,
  toggle lists) render however Notion's own Markdown export represents
  them — the adapter does not reinterpret Notion's Markdown output.
- ✗ the multi-part ZIP produced by exporting an entire large workspace
  (`Part-1.zip`, `Part-2.zip`, ...) is not stitched back together; convert
  each part separately.

## Slack

**Accepted input:** Official Slack workspace export ZIP (or the extracted
directory) — the admin-initiated "Export" that produces `channels.json`,
`users.json`, and one directory per channel containing one JSON file per
day (`YYYY-MM-DD.json`) of message objects.

**Supported:**

- ✓ channels as `Conversation` entities, users as `Person` entities
- ✓ messages merged and sorted chronologically across all of a channel's
  day files
- ✓ threads: replies are linked to their parent via `parentMessageId`
- ✓ inline Slack markup rendered to plain/Markdown text: user mentions
  (`<@U123>`), channel references (`<#C123|name>`), `<!here>`/`<!channel>`/
  `<!everyone>`, and links (`<https://x|label>`)
- ✓ bot messages (`bot_id`, no `user`) get a synthetic `Person` so the
  message isn't authorless
- ✓ reactions and message subtypes preserved in `metadata.slack`

**Partially supported:**

- △ file attachments — Slack's official export includes only file
  *metadata* (name, mimetype, size, a `url_private` download URL), never
  the bytes. Downloading from `url_private` requires authentication and is
  out of scope for a local-first, official-exports-only tool (AGENT.md
  section 2.2). Metadata is preserved on the message and reported as a
  `lossy-conversion` diagnostic; no `Attachment` entity is created.
- △ an unrecognized inline markup token (anything not matching a known
  `<...>` shape) is left as-is in the text and reported as `unsupported`,
  rather than guessed at.
- △ a thread reply whose parent message falls outside the exported date
  range is kept (with no `parentMessageId`) and reported as
  `missing-reference`, rather than dropped.

**Unsupported:**

- ✗ rich `blocks`/legacy `attachments` message formatting (Slack's
  structured message layout, as opposed to plain `text`) is not
  reconstructed — only the plain-text `text` field is converted.

## Trello

**Accepted input:** Official Trello board "Export as JSON" file (Menu → Print,
export, and share → Export as JSON) — a single loose `.json` file, or that
file inside a directory. Detection is purely structural (an object with
`id`, `name`, `lists[]`, and `cards[]`); the filename is never checked, since
Trello does not use a fixed one.

**Supported:**

- ✓ the board as a `Workspace`, lists as `Collection` entities, cards as
  `Document` entities (`parentId` linking card → list → board)
- ✓ members as `Person` entities
- ✓ card comments (`commentCard` actions) as `Message` entities, linked back
  to their card via a `Relation` entity (`relationKind: "comment-on"`)
- ✓ card assignees, linked via a `Relation` entity
  (`relationKind: "assigned-to"`)
- ✓ checklists, rendered as a Markdown checkbox list appended to the card's
  content
- ✓ creation timestamps for boards, lists, cards, and members, recovered
  from the Unix timestamp embedded in their MongoDB ObjectId — Trello's own
  export does not include a `dateCreated` field for these

**Partially supported:**

- △ attachments — Trello's JSON export includes only attachment *metadata*
  (name, URL), never the bytes. Preserved on the card's metadata and
  reported as a `lossy-conversion` diagnostic; no `Attachment` entity is
  created (same constraint as Slack's file attachments).
- △ comments are preserved as canonical `Message` entities in every output
  format, but the `markdown` exporter only renders `Conversation` and
  `Document` entities into files — comments on a card are not inlined into
  that card's `.md` file. They remain fully available in `json`, `jsonl`,
  and `filesystem` output.

**Unsupported:**

- ✗ non-comment activity log entries (`updateCard`, `addAttachmentToCard`,
  `moveCardToBoard`, etc.) are not converted to canonical entities; reported
  as an `unsupported` diagnostic count.

## Evernote

**Accepted input:** Official Evernote "Export as .enex" file for a
notebook (a single `.enex` XML file, or that file inside a directory).
Detection requires both the `.enex` extension and a structurally valid
`<en-export>` root element — the file is parsed with a non-validating,
pure-JS XML parser ([fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser))
that never resolves the external DTD `.enex` declares, so parsing an export
can never trigger a network fetch or an XXE-style attack (AGENT.md sections
2.1 and 17).

**Supported:**

- ✓ the notebook (named from the `.enex` filename — Evernote's export
  format has no separate notebook-name field) as a `Collection`, notes as
  `Document` entities (`format: "html"`, since note content is ENML, an
  HTML-like markup Evernote itself defines)
- ✓ **attachment bytes are actually copied into the output** — the
  `filesystem` and `markdown` exporters write the real file, not just
  metadata. Evernote is the first source where OpenUnlock can do this: its
  export embeds attachments as base64 directly in the XML, unlike ChatGPT,
  Notion, or Slack, which only ever reference files that live outside the
  export. `<en-media>` references in note content are rewritten to a
  resolvable link, exactly like Notion's page-to-page links.
- ✓ note authors, recovered from `<note-attributes><author>`, as `Person`
  entities
- ✓ tags, source URL, and other note attributes, preserved in
  `metadata.evernote`
- ✓ creation/update timestamps, converted from Evernote's compact
  `YYYYMMDDTHHMMSSZ` format to ISO 8601

**Partially supported:**

- △ ENML content is preserved as-is (`format: "html"`) rather than
  converted to Markdown — OpenUnlock doesn't reinterpret Evernote's own
  markup, consistent with how the Notion adapter doesn't reinterpret
  Notion's Markdown export.
- △ only the `filesystem` and `markdown` exporters copy attachment bytes;
  `json` and `jsonl` output the `Attachment` entity's metadata only (same
  as every other adapter) since embedding base64 data in those formats
  would defeat Git-friendly diffing (AGENT.md section 2.5).

**Unsupported:**

- ✗ a `<resource>` with no `<data>` block (rare, but possible) is reported
  as `unsupported` rather than modeled as an attachment.
- ✗ an `<en-media>` reference whose hash doesn't match any resource in the
  same note is reported as `missing-reference` and left untouched in the
  content.

## Discord

**Accepted input:** Official Discord "Request all of my Data" personal
export (a directory, or the extracted archive) — specifically
`messages/index.json` plus one `messages/c<channelId>/` directory per
channel, each with `channel.json` and `messages.json`.

**Supported:**

- ✓ every channel (server channels and DMs alike) as a `Conversation`,
  titled from Discord's own `messages/index.json` label
- ✓ messages as `Message` entities, sorted chronologically
- ✓ timestamps, converted from Discord's `YYYY-MM-DD HH:MM:SS` UTC format
  to ISO 8601

**A source quirk worth knowing:** this is a *personal* data export, so
`messages.json` only ever contains messages the exporting account itself
sent — Discord's privacy design excludes everyone else's message content.
There is no per-message author field in the export at all. The adapter
reflects this exactly: every message is attributed to one synthetic
`Person` representing the account owner (from `account/user.json`, if
present), not modeled as a normal multi-participant conversation.

**Partially supported:**

- △ attachments appear only as CDN URLs, which expire and require
  authentication to fetch — same constraint as Slack. Preserved in
  `metadata.discord.attachmentUrls` and reported as `lossy-conversion`; no
  `Attachment` entity is created.
- △ mention tokens (`<@id>`, `<#id>`, etc.) inside message content are
  preserved exactly as Discord wrote them, not rewritten to display names
  — the export doesn't include a member/role directory to resolve them
  against, unlike Slack's per-workspace `users.json`.

**Unsupported:**

- ✗ reactions, threads-as-distinct-from-channels, and voice/video state are
  not part of this personal export and so have nothing to convert from.

## Linear

**Accepted input:** A CSV exported from a Linear issue list view ("Export
CSV" in the view's `...` menu) — a single loose `.csv` file, or that file
inside a directory. Linear doesn't use a fixed filename, and its column
names have drifted across releases, so detection and column access are
both structural rather than name-exact: an id-shaped column, a title-ish
column, at least one other Linear-specific column (team/cycle/URL), and
values that look like Linear issue keys (`ENG-42`) — never the filename.

**Supported:**

- ✓ issues as `Document` entities (`format: "markdown"`, since Linear
  issue descriptions are already Markdown), grouped under a `Collection`
  per team
- ✓ assignees as `Person` entities
- ✓ parent/sub-issue relationships as `Relation` entities
  (`relationKind: "sub-issue-of"`), matched by issue key against every
  other row in the same export
- ✓ status, priority, labels, cycle, and project preserved in
  `metadata.linear`
- ✓ created/updated timestamps

**Partially supported:**

- △ column names are resolved through a small alias list (e.g. "Parent
  issue" / "Parent Issue" / "Parent") rather than one exact name, since
  Linear's own export has used different labels across versions; an export
  using column names outside that list degrades to the field being absent
  (visible in `diagnostics.json`, not silently wrong), rather than failing
  detection entirely.

**Unsupported:**

- ✗ comments, attachments, and activity history are not part of a CSV
  issue export and so have nothing to convert from — Linear doesn't offer
  a richer official bulk-export format at this time.
- ✗ a row missing an id-shaped value is skipped with a `malformed-source`
  diagnostic rather than guessed at.

## Airtable

**Accepted input:** One or more CSVs downloaded from an Airtable grid view
("Download CSV" in the view's `...` menu) — Airtable has no official
"export the whole base" feature, so a base with several tables means
several CSV files, each converted independently.

**A structural honesty note:** unlike every other source in this table,
a plain Airtable CSV has *no* reliable structural signature — field names
are entirely user-defined, so a table export can look identical to any
other spreadsheet. Detection reflects this instead of pretending
otherwise: it's confident (≥ 0.8) only when a cell contains an Airtable
CDN attachment URL (`dl.airtable.com` / `*.airtableusercontent.com`),
which is genuinely unique to Airtable. Without that evidence — a common
case for tables with no attachment field — confidence stays low (0.3,
below the auto-detection threshold), and `openunlock convert` will ask for
`--from airtable` rather than guess (AGENT.md section 8). This isn't a gap
to fix; it's the honest shape of the problem.

**Supported:**

- ✓ each table as a `Collection` (titled from the filename, with
  Airtable's default `-Grid view` suffix stripped), each row as a
  `Document` — the table's first column (Airtable always exports the
  primary field first) becomes the title, every other field becomes a
  bulleted line in the content
- ✓ cells containing an Airtable CDN attachment URL are still preserved as
  plain text in the content (nothing is deleted), and reported as
  `lossy-conversion` since the bytes themselves aren't in the export

**Unsupported:**

- ✗ linked-record fields export as the linked row's primary-field text
  (not a stable id), so they can't be reliably turned into `Relation`
  entities — they're preserved as plain text, same as any other field,
  with no attempt to guess at the relationship.
- ✗ row order is the only identity a row has in this format (like Notion's
  CSV database rows) — reordering rows between exports changes row ids.

## Google Keep

**Accepted input:** A [Google Takeout](https://takeout.google.com) export
of the "Keep" product — one `.json` file per note (Takeout also writes a
sibling `.html` file per note and, for notes with images, the actual
attachment image files alongside them; this adapter reads the `.json`
files and ignores the `.html` duplicates). This is one Takeout *module*,
not a general Takeout adapter — see AGENT.md section 32 for why a single
adapter trying to handle every unrelated Takeout format at once isn't the
right shape.

Detection is structural: a JSON object carrying Keep's distinctive trio of
`isTrashed`/`isPinned`/`isArchived` boolean flags, never the filename
(Takeout names note files after their title, which is arbitrary and often
missing).

**Supported:**

- ✓ notes as `Document` entities (`format: "markdown"`) — a plain note's
  `textContent` is used as-is; a checklist note's `listContent` is
  rendered as a Markdown checkbox list
- ✓ **attachment bytes are actually copied** — like Evernote, Google
  Keep's Takeout export embeds the real image files (as siblings of the
  note JSON, referenced by relative path), not just metadata. The
  `filesystem` and `markdown`/`obsidian`/`html` exporters copy them for
  real.
- ✓ labels, pin/archive/trash state, and color preserved in
  `metadata.googleKeep`
- ✓ creation/last-edited timestamps, converted from Keep's own
  microseconds-since-epoch unit to ISO 8601

**Unsupported:**

- ✗ notes have no id of their own in the export; canonical ids are
  derived from a fingerprint of the note's path, title, and creation
  timestamp — a note with no title and no creation timestamp that's byte-
  identical to another such note would collide (an edge case, not
  expected in practice).
- ✗ an attachment referenced by a note but not found in the export
  (`missing-reference`) or with no `filePath` at all (`unsupported`) is
  reported, not guessed at.

## Google Tasks

**Accepted input:** A [Google Takeout](https://takeout.google.com) export
of the "Tasks" product — one `.json` file per task list, matching the
shape of the Google Tasks API itself (`"kind": "tasks#taskList"` /
`"tasks#task"`). Another single Takeout module, scoped like Google Keep —
see AGENT.md section 32.

Detection is structural: the exact `kind` discriminators Google's own API
uses, never the filename (Takeout names list files after their title,
which is arbitrary).

**Supported:**

- ✓ task lists as `Collection` entities, tasks as `Document` entities
  (`format: "text"`, since a task's `notes` field is plain text, not
  markup)
- ✓ sub-tasks (a task's `parent` field) as `Relation` entities
  (`relationKind: "sub-task-of"`), matched by task id against every other
  task in the same list — the same pattern used for Linear's
  `sub-issue-of` relations
- ✓ status (`needsAction`/`completed`), due date, and completion timestamp
  preserved in `metadata.googleTasks`
- ✓ timestamps are already RFC 3339 in the source, so no custom parsing is
  needed (unlike Keep's microseconds-since-epoch or Discord's compact
  format)

**Unsupported:**

- ✗ a task with no id is skipped with a `malformed-source` diagnostic
  (ids are required to resolve `parent` references, so there's no
  reasonable fallback for one).
- ✗ a `parent` reference to a task not present in the same list/export is
  reported as `missing-reference`, not silently dropped or guessed at.

## Exporters

| Exporter   | Output                                                          |
| ---------- | ---------------------------------------------------------------- |
| markdown   | One `.md` file per conversation/document, deterministic filenames |
| json       | Single `entities.json` array, canonical entities, sorted         |
| jsonl      | `entities.jsonl`, one canonical entity per line, sorted           |
| filesystem | One JSON file per entity, organized by type into subdirectories  |
| sqlite     | Single `openunlock.sqlite` file, one table per entity type       |
| obsidian   | Same layout as `markdown`, but internal links use Obsidian Wikilinks |
| html       | Browsable offline static site: one `.html` page per conversation/document, an `index.html` |
| mattermost | Single `mattermost-import.jsonl` (Mattermost's official bulk-import format) |

Every exporter also writes an archive manifest and machine-readable
diagnostics — as `openunlock.json` / `diagnostics.json` for
markdown/json/jsonl/filesystem, or as the `openunlock_manifest` /
`diagnostic` tables for `sqlite` (a single binary file has nowhere else to
put them).

The `filesystem` exporter additionally writes `checksums.json`, mapping every
other file it wrote to a SHA-256 checksum of its contents (sorted by path for
deterministic, diffable output). `openunlock doctor` uses this manifest to
detect files that were modified or corrupted after conversion, on top of its
existing checks (broken references, duplicate ids, missing/mismatched
attachment checksums, unsafe filenames, and orphaned attachment files not
referenced by any entity).

When an adapter recovers real attachment bytes from the source export (only
Evernote, so far — see above), `filesystem`, `markdown`, `obsidian`, and
`html` all copy those bytes into `attachments/<file>` and register a
checksum for them (where applicable); `json` and `jsonl` never do,
regardless of source, to keep their output pure metadata.

### sqlite

Built on Node's experimental `node:sqlite` module (no separate database
engine or dependency to install) — requires **Node.js 22.5+**; on an older
runtime, `--to sqlite` fails with a clear error rather than a cryptic one.
One table per canonical entity type (`workspace`, `collection`, `document`,
`conversation`, `message`, `person`, `attachment`, `relation`); array-valued
fields (e.g. `Document.attachments`, `Conversation.messageIds`) are stored
as JSON text columns rather than join tables, queryable with SQLite's
`json_each()`.

Unlike every other exporter, `sqlite` is deliberately **not** part of the
Git-friendly family: a binary database file can't be meaningfully diffed,
so it trades that property away in exchange for local SQL queryability
(AGENT.md section 5 lists it as a natural follow-on once the canonical
schema stabilizes, separately from the diff-oriented json/jsonl/filesystem/
markdown formats). Row insertion order is still fully deterministic
(sorted by type then id, like every other exporter), so query results are
reproducible even though the underlying file's bytes aren't guaranteed to
be.

### obsidian

The same output shape as `markdown` (same folders, same frontmatter, same
attachment-copying behavior for adapters that provide real bytes), but the
generic `openunlock://entity/<id>` link scheme resolves to
[Obsidian Wikilinks](https://help.obsidian.md/Linking+notes+and+files/Internal+links)
instead of a relative Markdown path:

- a link to another note becomes `[[filename|original label]]`
- an embed (the source markup had a leading `!`, e.g. an image) becomes
  `![[filename]]`

Wikilinks resolve by filename across the whole vault rather than by
relative path, so — unlike the plain `markdown` exporter's output — an
Obsidian vault survives being reorganized into different folders later
without breaking internal links. This is the only difference between the
two exporters; everything else (filename rules, deterministic ordering,
diagnostics) is identical.

### html

A fully offline, browsable static site — open `index.html` directly in a
browser (`file://`, no server needed), and every internal link is a real,
working relative link, not a placeholder. No external stylesheet or script
is loaded (AGENT.md section 2.1, Local-first); a small inline `<style>`
block is the only styling.

Content handling depends on the `Document.format` field, and is written
to be safe against a malicious or corrupted source export
(AGENT.md section 17 — never render untrusted HTML unsanitized):

- `format: "markdown"` / `"text"` (most sources): the raw text is
  HTML-escaped, not interpreted as markup — a ChatGPT message that
  literally contains `<script>...</script>` as text renders as visible,
  inert text, never executes.
- `format: "html"` (Evernote's ENML): run through
  [sanitize-html](https://github.com/apostrophecms/sanitize-html) with a
  safe allowlist (its own conservative defaults, plus `<img>` for
  Evernote's embedded images) — actual formatting tags are preserved,
  but `<script>`, event-handler attributes (`onerror`, etc.), and
  `javascript:` URIs are stripped before anything reaches a browser.

In both cases, `openunlock://entity/<id>` links/embeds are resolved to
real relative-path `<a>`/`<img>` tags first, consistent with how
`markdown` and `obsidian` handle the same scheme.

### mattermost

Produces `mattermost-import.jsonl`, matching
[Mattermost's official bulk-import format](https://docs.mattermost.com/manage/bulk-loading-data.html)
consumed by `mmctl import bulk` — the destination end of the
`Slack → OpenUnlock → Mattermost` migration path AGENT.md names as a
primary use case. Generic over the canonical model
(`Workspace → team`, `Conversation → channel`, `Person → user`,
`Message → post`), so it isn't limited to Slack input, but Slack is the
realistic case: Discord's export only contains the account owner's own
messages (see above), and single-author sources like ChatGPT/Claude have
nothing thread-like to preserve.

**Accuracy note:** built carefully against Mattermost's documented schema,
but not verified against a real Mattermost import — this project has no
way to run `mmctl` or a Mattermost server. Treat the output as a solid
starting point and validate with `mmctl import bulk --dry-run` against a
test instance before a production migration.

**Known, deliberate simplifications:**

- ✓ replies are threaded under their root post's `replies` array (matching
  Mattermost's schema); a reply-to-a-reply is flattened onto the original
  thread root, since neither the canonical model nor Mattermost's
  bulk-import format represents deeper nesting.
- ✓ usernames/channel names are deterministically slugified with a hash
  suffix for guaranteed uniqueness and schema validity, even when display
  names collide, are empty, or contain characters Mattermost disallows —
  at the cost of prettiness.
- ⚠ every imported user gets the same fixed, publicly-documented
  placeholder password (never a per-user derived value, which would be a
  guessable "secret") — source exports never contain real passwords. A
  `warning` diagnostic is emitted once per conversion; local admins must
  force a password reset for all imported users before allowing login.
- ⚠ a user with no real email (most sources) gets a synthesized address on
  the `imported.invalid` domain — reserved by IANA for exactly this kind
  of placeholder use, never a real, deliverable domain.
