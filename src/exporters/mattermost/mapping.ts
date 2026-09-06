import type { Conversation, Message, Person, Workspace } from "../../core/canonical/types.js";
import { shortId } from "../../utils/hashing.js";
import { slugify } from "../../utils/filenames.js";

/**
 * Mapping helpers for Mattermost's official bulk-import JSONL format
 * (`mmctl import bulk`). This exporter is generic over the canonical
 * model — Workspace/Conversation/Person/Message → team/channel/user/post
 * — but the primary real-world use case is Slack → Mattermost (AGENT.md
 * section 1's own example migration path).
 *
 * This has been built carefully against Mattermost's documented schema,
 * but not verified against a live Mattermost import (this project has no
 * way to run one) — treat the output as a solid starting point and
 * validate with a real `mmctl import bulk --dry-run` before trusting it
 * for a production migration.
 */

const RESERVED_EMAIL_DOMAIN = "imported.invalid";

/**
 * A fixed, publicly-documented placeholder — not a secret, not derived
 * from any per-user data (which would make it a guessable "secret").
 * Source exports never contain real passwords, so every imported user
 * gets this one; the accompanying diagnostic and docs both say local
 * admins must force a password reset before allowing login.
 */
export const PLACEHOLDER_PASSWORD = "ChangeMe1234!ImportPlaceholder";

function ensureStartsWithLetter(value: string, prefix: string): string {
  return /^[a-z]/.test(value) ? value : `${prefix}${value}`;
}

export function toMattermostTeamName(workspace: Workspace | undefined, sourceService: string): string {
  const base = workspace?.title ? slugify(workspace.title) : undefined;
  const name = base && base !== "untitled" ? base : `${slugify(sourceService)}-import`;
  return name.slice(0, 64);
}

export function toMattermostChannelName(conversation: Conversation): string {
  const base = slugify(conversation.title);
  const hash = shortId(conversation.source.service, conversation.id).slice(0, 8);
  return `${base}-${hash}`.slice(0, 64);
}

/**
 * Mattermost usernames must be 3-22 chars, lowercase letters/digits/`.`/
 * `-`/`_`, starting with a letter. A hash suffix is always appended so
 * usernames stay unique even when display names collide or are empty —
 * readability is traded for a guarantee the import won't fail on a
 * duplicate-username conflict.
 */
export function toMattermostUsername(person: Person): string {
  const hash = shortId(person.source.service, person.id).slice(0, 8);
  const base = (person.displayName ?? person.id)
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "")
    .slice(0, 12);
  const withHash = base.length > 0 ? `${base}-${hash}` : `u-${hash}`;
  return ensureStartsWithLetter(withHash, "u-").slice(0, 22);
}

export function toMattermostEmail(person: Person, username: string): string {
  return person.email ?? `${username}@${RESERVED_EMAIL_DOMAIN}`;
}

export interface ThreadedPost {
  rootMessage: Message;
  replies: Message[];
}

/**
 * Group a conversation's messages into Mattermost's "root post + inline
 * replies" shape. The canonical model only tracks one parent link per
 * message, so a reply-to-a-reply is flattened onto the original thread
 * root — Mattermost's bulk-import schema has no deeper nesting either.
 */
export function threadMessages(messages: Message[]): ThreadedPost[] {
  const byId = new Map(messages.map((m) => [m.id, m]));

  const rootIdFor = (message: Message): string => {
    let current = message;
    const seen = new Set<string>();
    while (current.parentMessageId && byId.has(current.parentMessageId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parentMessageId)!;
    }
    return current.id;
  };

  const threads = new Map<string, ThreadedPost>();
  for (const message of messages) {
    const rootId = rootIdFor(message);
    if (message.id === rootId) {
      if (!threads.has(rootId)) {
        threads.set(rootId, { rootMessage: message, replies: [] });
      } else {
        threads.get(rootId)!.rootMessage = message;
      }
    } else {
      if (!threads.has(rootId)) {
        threads.set(rootId, { rootMessage: byId.get(rootId)!, replies: [] });
      }
      threads.get(rootId)!.replies.push(message);
    }
  }

  return Array.from(threads.values());
}

export function toEpochMillis(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
