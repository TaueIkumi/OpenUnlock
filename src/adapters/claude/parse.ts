import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { isPlausibleClaudeConversationsArray } from "./parse-source.js";
import { normalizeConversation } from "./normalize.js";

const CONVERSATIONS_FILE = "conversations.json";

export async function* parseClaude(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const text = await input.readText(CONVERSATIONS_FILE);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MalformedExportError(
      `Failed to parse ${CONVERSATIONS_FILE}: not valid JSON. This export may be corrupted.`,
    );
  }

  if (!isPlausibleClaudeConversationsArray(data)) {
    throw new MalformedExportError(
      `${CONVERSATIONS_FILE} does not match the expected Claude.ai export structure ` +
        `(expected a JSON array of conversation objects with a "chat_messages" field). ` +
        `This export may be newer or older than the installed Claude adapter supports.`,
    );
  }

  const seenPeople = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    if (!raw) continue;

    let normalized;
    try {
      normalized = normalizeConversation(raw, i, context.diagnostics);
    } catch (err) {
      context.diagnostics.malformedSource(
        `Skipped conversation at index ${i}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    for (const person of normalized.people) {
      if (!seenPeople.has(person.id)) {
        seenPeople.add(person.id);
        yield person;
      }
    }

    yield normalized.conversation;
    for (const message of normalized.messages) {
      yield message;
    }
  }
}
