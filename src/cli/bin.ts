import { readFileSync } from "node:fs";
import ora from "ora";

import {
  createModelAccumulator,
  createOverallAccumulator,
  createPeriodAccumulator,
  validateFilters,
} from "../core/aggregator";
import { formatCliError } from "./cli-error";
import { type CliOptions, createProgram } from "./cli-setup";
import { formatModelTable, formatPeriodTable, formatTodaySummary } from "./formatter";
import { forEachMessage } from "../io/loader";
import type { FilterOptions, Granularity, Message } from "../core/types";
import { formatLocalDate } from "../shared/date-utils";

interface SpinnerHandle {
  succeed(): void;
}

function getCliVersion(): string {
  try {
    const text = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
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

interface MessageAccumulator<Result> {
  consume(message: Message): void;
  result(): Result;
}

async function runAccumulator<Result>(accumulator: MessageAccumulator<Result>): Promise<Result> {
  const spinner = startSpinner("Loading OpenCode usage data...");
  await forEachMessage((message) => {
    accumulator.consume(message);
  });
  spinner.succeed();
  return accumulator.result();
}

async function runPeriod(granularity: Granularity, options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  validateFilters(filters, true);

  const { periods, overall } = await runAccumulator(createPeriodAccumulator(granularity, filters));

  console.log(formatPeriodTable(overall, periods));
}

async function runToday(options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  const today = formatLocalDate(new Date());
  const todayFilters: FilterOptions = { ...filters, from: filters.from ?? today, to: filters.to ?? today };
  validateFilters(todayFilters, true);

  const overall = await runAccumulator(createOverallAccumulator(todayFilters));

  console.log(formatTodaySummary(overall));
}

async function runModels(options: CliOptions): Promise<void> {
  const filters = toFilters(options);
  validateFilters(filters, true);

  const { models, overall } = await runAccumulator(createModelAccumulator(filters));

  console.log(formatModelTable(overall, models));
}

const program = createProgram(getCliVersion(), {
  runPeriod,
  runModels,
  runToday,
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
