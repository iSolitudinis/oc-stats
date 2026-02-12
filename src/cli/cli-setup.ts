import { Command } from "commander";

import type { Granularity } from "../core/types";

export interface CliOptions {
  model?: string;
  from?: string;
  to?: string;
}

interface CliHandlers {
  runPeriod(granularity: Granularity, options: CliOptions): Promise<void>;
  runModels(options: CliOptions): Promise<void>;
  runToday(options: CliOptions): Promise<void>;
}

function addSharedOptions(command: Command): Command {
  return command
    .option("-m, --model <model>", "Filter by providerID/modelID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)");
}

export function createProgram(version: string, handlers: CliHandlers): Command {
  const program = new Command();

  program.name("oc-stats").description("Analyze OpenCode usage statistics").version(version).enablePositionalOptions();

  addSharedOptions(program.command("daily").description("Show daily usage stats")).action(async (opts: CliOptions) => {
    await handlers.runPeriod("daily", opts);
  });

  addSharedOptions(program.command("weekly").description("Show weekly usage stats")).action(async (opts: CliOptions) => {
    await handlers.runPeriod("weekly", opts);
  });

  addSharedOptions(program.command("monthly").description("Show monthly usage stats")).action(async (opts: CliOptions) => {
    await handlers.runPeriod("monthly", opts);
  });

  addSharedOptions(program.command("yearly").description("Show yearly usage stats")).action(async (opts: CliOptions) => {
    await handlers.runPeriod("yearly", opts);
  });

  addSharedOptions(program.command("models").description("Show usage breakdown by model")).action(async (opts: CliOptions) => {
    await handlers.runModels(opts);
  });

  addSharedOptions(program).action(async (opts: CliOptions) => {
    await handlers.runToday(opts);
  });

  return program;
}
