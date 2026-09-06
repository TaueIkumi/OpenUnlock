#!/usr/bin/env node
import { Command } from "commander";
import { registerInspectCommand } from "./commands/inspect.js";
import { registerConvertCommand } from "./commands/convert.js";
import { registerDoctorCommand } from "./commands/doctor.js";

const program = new Command();

program
  .name("openunlock")
  .description("Convert official SaaS exports into clean, portable, diffable, open data")
  .version("0.1.0");

registerInspectCommand(program);
registerConvertCommand(program);
registerDoctorCommand(program);

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
