import { describe, expect, it } from "vitest";
import { detectSource } from "./detection.js";
import { AmbiguousFormatError } from "./errors.js";
import type { SourceAdapter } from "./adapter.js";
import type { InputSource } from "./input.js";

function fakeAdapter(id: string, confidence: number): SourceAdapter {
  return {
    id,
    displayName: id,
    detect: async () => ({ adapter: id, confidence, evidence: [] }),
    inspect: async () => ({ source: id, confidence, contents: [], potentialIssues: [] }),
    parse: async function* () {},
  };
}

const fakeInput = {} as InputSource;

describe("detectSource", () => {
  it("picks the adapter with the highest confidence", async () => {
    const adapters = [fakeAdapter("a", 0.4), fakeAdapter("b", 0.95)];
    const { adapter } = await detectSource(fakeInput, adapters);
    expect(adapter.id).toBe("b");
  });

  it("throws AmbiguousFormatError when no adapter is confident", async () => {
    const adapters = [fakeAdapter("a", 0.1), fakeAdapter("b", 0.2)];
    await expect(detectSource(fakeInput, adapters)).rejects.toThrow(AmbiguousFormatError);
  });

  it("throws AmbiguousFormatError when two adapters are near-tied", async () => {
    const adapters = [fakeAdapter("a", 0.9), fakeAdapter("b", 0.88)];
    await expect(detectSource(fakeInput, adapters)).rejects.toThrow(AmbiguousFormatError);
  });
});
