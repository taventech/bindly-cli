#!/usr/bin/env node
import { Command } from "commander";
import { ApiError } from "./core/index.js";
import { registerAuth } from "./commands/auth.js";
import { registerSessions } from "./commands/sessions.js";

const program = new Command();
program
  .name("bindly")
  .description("Start Bindly intake sessions and submit to Hedge from your terminal.")
  .version("0.1.0")
  .option("--json", "output raw JSON (for scripting)");

registerAuth(program);
registerSessions(program);

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      process.stderr.write(`\n${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
main();
