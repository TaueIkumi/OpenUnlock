import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openInputSource } from "../../src/core/input.js";
import { runPipeline } from "../../src/core/pipeline.js";
import { slackAdapter } from "../../src/adapters/slack/index.js";
import { mattermostExporter } from "../../src/exporters/mattermost/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(testDir, "../../src/adapters/slack/fixtures/threads");
const snapshotPath = path.join(testDir, "../snapshots/mattermost/slack-threads/mattermost-import.jsonl");

describe("mattermost exporter (Slack -> Mattermost bulk import)", () => {
  it("produces deterministic, golden-matching, line-valid JSONL", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-mattermost-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, slackAdapter, mattermostExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const generated = await readFile(path.join(outDir, "mattermost-import.jsonl"), "utf8");
      const expected = await readFile(snapshotPath, "utf8");
      expect(generated).toBe(expected);

      const lines = generated.trim().split("\n");
      const parsed = lines.map((line) => JSON.parse(line));
      expect(parsed[0]).toEqual({ type: "version", version: 1 });
      expect(parsed.filter((l) => l.type === "team")).toHaveLength(1);
      expect(parsed.filter((l) => l.type === "channel")).toHaveLength(1);
      expect(parsed.filter((l) => l.type === "user")).toHaveLength(2);

      const post = parsed.find((l) => l.type === "post");
      expect(post.post.replies).toHaveLength(2);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("threads replies under their root post rather than as separate top-level posts", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "openunlock-mattermost-thread-"));
    try {
      const input = await openInputSource(fixtureDir);
      await runPipeline(input, slackAdapter, mattermostExporter, {
        outputDir: outDir,
        overwrite: true,
        dryRun: false,
      });

      const generated = await readFile(path.join(outDir, "mattermost-import.jsonl"), "utf8");
      const posts = generated
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((l) => l.type === "post");
      // A root message plus two threaded replies must be exactly one post line.
      expect(posts).toHaveLength(1);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
