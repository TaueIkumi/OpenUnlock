import type { InputSource } from "../../core/input.js";
import type { AdapterContext } from "../../core/adapter.js";
import type { AnyCanonicalEntity } from "../../core/canonical/types.js";
import { MalformedExportError } from "../../core/errors.js";
import { findGeminiGemsFile, findScheduledActionsFile, isEmptyTakeoutFragment } from "./parse-source.js";
import { normalizeGem } from "./normalize.js";

export async function* parseGeminiGems(
  input: InputSource,
  context: AdapterContext,
): AsyncIterable<AnyCanonicalEntity> {
  const found = await findGeminiGemsFile(input);
  if (!found) {
    throw new MalformedExportError(
      "No gemini_gems_data.html file with a valid Gemini Gems export structure was found.",
    );
  }

  for (const [index, gem] of found.gems.entries()) {
    yield normalizeGem(found.path, gem, index, context.diagnostics);
  }

  // Scheduled actions have an unknown, unexplored schema when non-empty
  // (every real sample seen so far has been empty) — flag rather than
  // silently ignore, per AGENT.md section 8: never silently drop data.
  const scheduledActionsPath = await findScheduledActionsFile(input);
  if (scheduledActionsPath) {
    const html = await input.readText(scheduledActionsPath);
    if (!isEmptyTakeoutFragment(html)) {
      context.diagnostics.unsupported(
        `${scheduledActionsPath} contains data, but this adapter doesn't parse scheduled actions yet`,
        scheduledActionsPath,
      );
    }
  }
}
