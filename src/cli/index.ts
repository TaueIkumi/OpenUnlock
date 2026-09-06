#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerInspectCommand } from "./commands/inspect.js";
import { registerConvertCommand } from "./commands/convert.js";
import { registerDoctorCommand } from "./commands/doctor.js";

// Read from package.json rather than hardcoding, so --version can never
// drift out of sync with the published package again. This file lives at
// src/cli/index.ts (dev, via tsx) or dist/cli/index.js (built) — both are
// two directories below the package root, so the relative path is the same.
const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const program = new Command();

program
  .name("openunlock")
  .description("Convert official SaaS exports into clean, portable, diffable, open data")
  .version(version);

registerInspectCommand(program);
registerConvertCommand(program);
registerDoctorCommand(program);

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
