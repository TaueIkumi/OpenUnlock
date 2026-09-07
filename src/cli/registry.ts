import type { SourceAdapter } from "../core/adapter.js";
import type { Exporter } from "../core/exporter.js";
import { chatGptAdapter } from "../adapters/chatgpt/index.js";
import { notionAdapter } from "../adapters/notion/index.js";
import { slackAdapter } from "../adapters/slack/index.js";
import { trelloAdapter } from "../adapters/trello/index.js";
import { evernoteAdapter } from "../adapters/evernote/index.js";
import { discordAdapter } from "../adapters/discord/index.js";
import { claudeAdapter } from "../adapters/claude/index.js";
import { linearAdapter } from "../adapters/linear/index.js";
import { airtableAdapter } from "../adapters/airtable/index.js";
import { googleKeepAdapter } from "../adapters/google-keep/index.js";
import { googleTasksAdapter } from "../adapters/google-tasks/index.js";
import { geminiGemsAdapter } from "../adapters/gemini-gems/index.js";
import { markdownExporter } from "../exporters/markdown/index.js";
import { jsonExporter } from "../exporters/json/index.js";
import { jsonlExporter } from "../exporters/jsonl/index.js";
import { filesystemExporter } from "../exporters/filesystem/index.js";
import { sqliteExporter } from "../exporters/sqlite/index.js";
import { obsidianExporter } from "../exporters/obsidian/index.js";
import { htmlArchiveExporter } from "../exporters/html/index.js";
import { mattermostExporter } from "../exporters/mattermost/index.js";

export const adapters: readonly SourceAdapter[] = [
  chatGptAdapter,
  notionAdapter,
  slackAdapter,
  trelloAdapter,
  evernoteAdapter,
  discordAdapter,
  claudeAdapter,
  linearAdapter,
  airtableAdapter,
  googleKeepAdapter,
  googleTasksAdapter,
  geminiGemsAdapter,
];

export const exporters: readonly Exporter[] = [
  markdownExporter,
  jsonExporter,
  jsonlExporter,
  filesystemExporter,
  sqliteExporter,
  obsidianExporter,
  htmlArchiveExporter,
  mattermostExporter,
];

export const DEFAULT_EXPORTER_ID = "markdown";
