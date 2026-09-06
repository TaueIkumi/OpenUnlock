import { Command } from "commander";
import { openInputSource } from "../../core/input.js";
import { detectSource, getAdapterById } from "../../core/detection.js";
import { adapters } from "../registry.js";
import { printJson, printLine } from "../output.js";
import { handleCliError } from "../handle-error.js";

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect <input>")
    .description("Inspect a SaaS export without writing any output")
    .option("--from <adapter>", "force a specific source adapter")
    .option("--json", "print machine-readable JSON")
    .action(async (inputPath: string, options: { from?: string; json?: boolean }) => {
      try {
        const input = await openInputSource(inputPath);

        const adapter = options.from
          ? getAdapterByIdOrThrow(options.from)
          : (await detectSource(input, adapters)).adapter;

        const result = await adapter.inspect(input);

        if (options.json) {
          printJson(result);
          return;
        }

        printLine(`Source: ${adapter.displayName}`);
        printLine(`Confidence: ${Math.round(result.confidence * 100)}%`);
        printLine("");
        printLine("Contents:");
        for (const item of result.contents) {
          printLine(`  ${item.label}:${" ".repeat(Math.max(1, 14 - item.label.length))}${item.count.toLocaleString()}`);
        }
        if (result.potentialIssues.length > 0) {
          printLine("");
          printLine("Potential issues:");
          for (const issue of result.potentialIssues) {
            printLine(`  ${issue}`);
          }
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
