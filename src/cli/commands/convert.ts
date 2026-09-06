import { Command } from "commander";
import path from "node:path";
import { openInputSource } from "../../core/input.js";
import { detectSource, getAdapterById } from "../../core/detection.js";
import { runPipeline } from "../../core/pipeline.js";
import { adapters, exporters, DEFAULT_EXPORTER_ID } from "../registry.js";
import { printJson, printLine, printDiagnosticsSummary } from "../output.js";
import { handleCliError } from "../handle-error.js";

interface ConvertOptions {
  from?: string;
  to?: string;
  output?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  json?: boolean;
}

export function registerConvertCommand(program: Command): void {
  program
    .command("convert <input>")
    .description("Convert a SaaS export into a portable open format")
    .option("--from <adapter>", "force a specific source adapter")
    .option(
      "--to <exporter>",
      "output format (markdown, json, jsonl, filesystem, sqlite, obsidian, html, mattermost)",
      DEFAULT_EXPORTER_ID,
    )
    .option("--output <path>", "output directory", "./openunlock-output")
    .option(
      "--overwrite",
      "replace a previous OpenUnlock export at --output (refuses a non-empty directory that isn't one)",
    )
    .option("--dry-run", "run the full pipeline without writing files")
    .option("--verbose", "print adapter diagnostics")
    .option("--json", "print machine-readable JSON result")
    .action(async (inputPath: string, options: ConvertOptions) => {
      try {
        const input = await openInputSource(inputPath);

        if (!options.json) {
          printLine("Detecting source...");
        }
        const adapter = options.from
          ? getAdapterByIdOrThrow(options.from)
          : (await detectSource(input, adapters)).adapter;

        if (!options.json) {
          printLine(`Source: ${adapter.displayName}`);
          printLine("");
        }

        const exporter = getExporterByIdOrThrow(options.to ?? DEFAULT_EXPORTER_ID);
        const outputDir = path.resolve(options.output ?? "./openunlock-output");

        if (!options.json) {
          printLine("Parsing and writing output...");
        }

        const result = await runPipeline(input, adapter, exporter, {
          outputDir,
          overwrite: Boolean(options.overwrite),
          dryRun: Boolean(options.dryRun),
        });

        if (options.json) {
          printJson({
            source: result.sourceId,
            outputDir,
            entityCounts: result.exportResult.entityCounts,
            filesWritten: result.exportResult.filesWritten,
            diagnostics: result.diagnostics.all(),
          });
          if (result.diagnostics.hasErrors()) {
            process.exitCode = 1;
          }
          return;
        }

        for (const [type, count] of Object.entries(result.exportResult.entityCounts)) {
          printLine(`✓ ${count.toLocaleString()} ${type}${count === 1 ? "" : "s"}`);
        }
        printLine("");

        printDiagnosticsSummary(result.diagnostics.all());

        printLine("");
        printLine(`Output: ${options.dryRun ? "(dry run, nothing written)" : outputDir}`);

        if (result.diagnostics.hasErrors()) {
          process.exitCode = 1;
        }
      } catch (err) {
        handleCliError(err);
      }
    });
}

function getAdapterByIdOrThrow(id: string) {
  const adapter = getAdapterById(adapters, id);
  if (!adapter) {
    throw new Error(`Unknown adapter: ${id}. Available: ${adapters.map((a) => a.id).join(", ")}`);
  }
  return adapter;
}

function getExporterByIdOrThrow(id: string) {
  const exporter = exporters.find((e) => e.id === id);
  if (!exporter) {
    throw new Error(`Unknown exporter: ${id}. Available: ${exporters.map((e) => e.id).join(", ")}`);
  }
  return exporter;
}
