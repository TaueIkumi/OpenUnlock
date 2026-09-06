import type { SourceAdapter, DetectionResult } from "./adapter.js";
import type { InputSource } from "./input.js";
import { AmbiguousFormatError } from "./errors.js";

/** Below this confidence, detection is considered too weak to act on alone. */
export const MIN_CONFIDENT_DETECTION = 0.6;

export async function detectSource(
  input: InputSource,
  adapters: readonly SourceAdapter[],
): Promise<{ adapter: SourceAdapter; result: DetectionResult }> {
  const results = await Promise.all(
    adapters.map(async (adapter) => ({ adapter, result: await adapter.detect(input) })),
  );

  const sorted = [...results].sort((a, b) => b.result.confidence - a.result.confidence);
  const best = sorted[0];

  if (!best || best.result.confidence < MIN_CONFIDENT_DETECTION) {
    throw new AmbiguousFormatError(
      sorted.map((r) => `${r.adapter.id} (${Math.round(r.result.confidence * 100)}%)`),
    );
  }

  const runnerUp = sorted[1];
  if (runnerUp && runnerUp.result.confidence >= best.result.confidence - 0.05) {
    throw new AmbiguousFormatError([
      `${best.adapter.id} (${Math.round(best.result.confidence * 100)}%)`,
      `${runnerUp.adapter.id} (${Math.round(runnerUp.result.confidence * 100)}%)`,
    ]);
  }

  return best;
}

export function getAdapterById(
  adapters: readonly SourceAdapter[],
  id: string,
): SourceAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
