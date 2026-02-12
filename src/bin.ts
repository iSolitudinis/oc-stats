import { readFileSync } from "node:fs";
import { Command } from "commander";
import ora from "ora";

import {
  createModelAccumulator,
  createOverallAccumulator,
  createPeriodAccumulator,
  validateFilters,
} from "./aggregator";
import { formatCliError } from "./cli-error";
import { formatModelTable, formatPeriodTable, formatTodaySummary } from "./formatter";
import { forEachMessage } from "./loader";
import type { FilterOptions, Granularity } from "./types";
import { formatLocalDate } from "./utils";

interface CliOptions {
  model?: string;
  from?: string;
  to?: string;
}

interface SpinnerHandle {
  succeed(): void;
}

function getCliVersion(): string {
  try {
    const text = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(text) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // Ignore and use fallback.
  }

  return "0.0.0";
}

function startSpinner(label: string): SpinnerHandle {
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.VITEST_WORKER_ID !== undefined;
  const isInteractive = Boolean(process.stdout.isTTY) && !process.env.CI;

  if (isTestEnv) {
    return { succeed() {} };
  }

  return ora({ text: label, isEnabled: isInteractive }).start();
}

function toFilters(options: CliOptions): FilterOptions {
  return {
    model: options.model,
    from: options.from,
    to: options.to,
  };
}

async function runPeriod(granularity: Granularity, options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  validateFilters(filters, true);

  const spinner = startSpinner("Loading OpenCode usage data...");
  const accumulator = createPeriodAccumulator(granularity, filters);
  await forEachMessage((message) => {
    accumulator.consume(message);
  });
  spinner.succeed();

  const { periods, overall } = accumulator.result();

  console.log(formatPeriodTable(overall, periods));
}

async function runToday(options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  const today = formatLocalDate(new Date());
  const todayFilters: FilterOptions = { ...filters, from: filters.from ?? today, to: filters.to ?? today };
  validateFilters(todayFilters, true);

  const spinner = startSpinner("Loading OpenCode usage data...");
  const accumulator = createOverallAccumulator(todayFilters);
  await forEachMessage((message) => {
    accumulator.consume(message);
  });
  spinner.succeed();

  const overall = accumulator.result();

  console.log(formatTodaySummary(overall));
}

async function runModels(options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  validateFilters(filters, true);

  const spinner = startSpinner("Loading OpenCode usage data...");
  const accumulator = createModelAccumulator(filters);
  await forEachMessage((message) => {
    accumulator.consume(message);
  });
  spinner.succeed();

  const { models, overall } = accumulator.result();

  console.log(formatModelTable(overall, models));
}

function addSharedOptions(command: Command): Command {
  return command
    .option("-m, --model <model>", "Filter by providerID/modelID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)");
}

const program = new Command();

program
  .name("oc-stats")
  .description("Analyze OpenCode usage statistics")
  .version(getCliVersion())
  .enablePositionalOptions();

addSharedOptions(program.command("daily").description("Show daily usage stats")).action(async (opts: CliOptions) => {
  await runPeriod("daily", opts);
});

addSharedOptions(program.command("weekly").description("Show weekly usage stats")).action(async (opts: CliOptions) => {
  await runPeriod("weekly", opts);
});

addSharedOptions(program.command("monthly").description("Show monthly usage stats")).action(async (opts: CliOptions) => {
  await runPeriod("monthly", opts);
});

addSharedOptions(program.command("yearly").description("Show yearly usage stats")).action(async (opts: CliOptions) => {
  await runPeriod("yearly", opts);
});

addSharedOptions(program.command("models").description("Show usage breakdown by model")).action(async (opts: CliOptions) => {
  await runModels(opts);
});

// Default: show today's summary
addSharedOptions(program).action(async (opts: CliOptions) => {
  await runToday(opts);
});

export async function runCli(argv: string[]): Promise<void> {
  const normalizedArgv = argv.filter((arg, i) => !(arg === "--" && i === 2));
  await program.parseAsync(normalizedArgv);
}

runCli(process.argv).catch((error: unknown) => {
  for (const line of formatCliError(error)) {
    console.error(line);
  }
  process.exit(1);
});
