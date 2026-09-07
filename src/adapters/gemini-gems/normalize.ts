import type { DiagnosticCollector } from "../../core/diagnostics.js";
import type { Document } from "../../core/canonical/types.js";
import { shortId } from "../../utils/hashing.js";
import type { GeminiGem } from "./parse-source.js";

export function normalizeGem(
  gemsFilePath: string,
  gem: GeminiGem,
  index: number,
  diagnostics: DiagnosticCollector,
): Document {
  const documentId = `gemini-gems:document:${shortId("gemini-gems", gemsFilePath, String(index), gem.name)}`;

  if (!gem.name) {
    diagnostics.malformedSource(`Gem at position ${index} has no name`, documentId);
  }
  if (!gem.instructions) {
    diagnostics.malformedSource(`Gem "${gem.name || index}" has no custom instructions`, documentId);
  }

  if (gem.files.length > 0) {
    diagnostics.lossyConversion(
      `Gem references ${gem.files.length} file(s) via an authenticated Google-hosted URL; ` +
        "the export does not include the bytes",
      documentId,
    );
  }

  return {
    id: documentId,
    type: "document",
    title: gem.name || undefined,
    format: "text",
    content: gem.instructions,
    source: { service: "gemini-gems", sourcePath: gemsFilePath },
    metadata: {
      geminiGems: {
        files: gem.files.length > 0 ? gem.files : undefined,
      },
    },
  };
}
