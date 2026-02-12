import type { FilterOptions, Granularity, Message, ModelStats, PeriodStats } from "./types";
import { formatLocalDate, getPeriodKey, parseLocalDateEnd, parseLocalDateStart } from "./utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface MutableStats extends TokenTotals {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
}

interface ParsedFilters {
  model?: string;
  from?: number;
  to?: number;
}

function createTokenTotals(): TokenTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function createMutableStats(): MutableStats {
  return {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    ...createTokenTotals(),
  };
}

function parseDateStrict(date: string): number {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`);
  }

  const parsed = parseLocalDateStart(date);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid date value: ${date}.`);
  }

  if (formatLocalDate(new Date(parsed)) !== date) {
    throw new Error(`Invalid date value: ${date}.`);
  }

  return parsed;
}

function parseDateStart(date?: string): number | undefined {
  if (!date) {
    return undefined;
  }
  return parseDateStrict(date);
}

function parseDateEnd(date?: string): number | undefined {
  if (!date) {
    return undefined;
  }
  parseDateStrict(date);
  return parseLocalDateEnd(date);
}

function buildModelName(message: Message): string {
  const provider = message.providerID ?? "unknown";
  const model = message.modelID ?? "unknown";
  return `${provider}/${model}`;
}

function parseFilters(filters: FilterOptions, includeModel: boolean): ParsedFilters {
  validateFilters(filters, includeModel);
  return {
    model: filters.model,
    from: parseDateStart(filters.from),
    to: parseDateEnd(filters.to),
  };
}

function matchesFilters(message: Message, filters: ParsedFilters, includeModel: boolean): boolean {
  if (includeModel && filters.model && buildModelName(message) !== filters.model) {
    return false;
  }
  if (filters.from !== undefined && message.time.created < filters.from) {
    return false;
  }
  if (filters.to !== undefined && message.time.created > filters.to) {
    return false;
  }
  return true;
}

export function validateFilters(filters: FilterOptions, includeModel: boolean): void {
  if (includeModel && filters.model !== undefined && filters.model.trim().length === 0) {
    throw new Error("Invalid model filter: --model cannot be empty.");
  }

  const from = parseDateStart(filters.from);
  const to = parseDateEnd(filters.to);

  if (from !== undefined && to !== undefined && from > to) {
    throw new Error("Invalid date range: --from must be on or before --to.");
  }
}

function sumTokens(message: Message): number {
  if (!message.tokens) {
    return 0;
  }
  return (
    message.tokens.input +
    message.tokens.output +
    message.tokens.reasoning +
    message.tokens.cache.read +
    message.tokens.cache.write
  );
}

function applyMessageTotals(totals: TokenTotals, message: Message): void {
  if (!message.tokens) {
    return;
  }

  totals.inputTokens += message.tokens.input;
  totals.outputTokens += message.tokens.output;
  totals.reasoningTokens += message.tokens.reasoning;
  totals.cacheReadTokens += message.tokens.cache.read;
  totals.cacheWriteTokens += message.tokens.cache.write;
}

function applyToMutableStats(totals: MutableStats, message: Message): void {
  totals.totalRequests += 1;
  applyMessageTotals(totals, message);
  totals.totalTokens += sumTokens(message);
  totals.totalCost += message.cost ?? 0;
}

function toPeriodStats(period: string, totals: MutableStats): PeriodStats {
  return {
    period,
    totalRequests: totals.totalRequests,
    totalTokens: totals.totalTokens,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadTokens: totals.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    reasoningTokens: totals.reasoningTokens,
    totalCost: totals.totalCost,
  };
}

export function createPeriodAccumulator(
  granularity: Granularity,
  filters: FilterOptions,
): {
  consume(message: Message): void;
  result(): { overall: PeriodStats; periods: PeriodStats[] };
} {
  const parsedFilters = parseFilters(filters, true);
  const grouped = new Map<string, MutableStats>();
  const overall = createMutableStats();

  return {
    consume(message: Message): void {
      if (!matchesFilters(message, parsedFilters, true)) {
        return;
      }

      applyToMutableStats(overall, message);

      const period = getPeriodKey(message.time.created, granularity);
      const periodTotals = grouped.get(period) ?? createMutableStats();
      applyToMutableStats(periodTotals, message);
      grouped.set(period, periodTotals);
    },
    result(): { overall: PeriodStats; periods: PeriodStats[] } {
      const periods = [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, totals]) => toPeriodStats(period, totals));

      return {
        overall: toPeriodStats("Total", overall),
        periods,
      };
    },
  };
}

export function createModelAccumulator(
  filters: FilterOptions,
): {
  consume(message: Message): void;
  result(): { overall: PeriodStats; models: ModelStats[] };
} {
  const parsedFilters = parseFilters(filters, true);
  const grouped = new Map<string, MutableStats>();
  const overall = createMutableStats();

  return {
    consume(message: Message): void {
      if (!matchesFilters(message, parsedFilters, true)) {
        return;
      }

      applyToMutableStats(overall, message);

      const model = buildModelName(message);
      const modelTotals = grouped.get(model) ?? createMutableStats();
      applyToMutableStats(modelTotals, message);
      grouped.set(model, modelTotals);
    },
    result(): { overall: PeriodStats; models: ModelStats[] } {
      const models = [...grouped.entries()]
        .map(([model, totals]) => {
          return {
            model,
            totalRequests: totals.totalRequests,
            totalTokens: totals.totalTokens,
            inputTokens: totals.inputTokens,
            outputTokens: totals.outputTokens,
            cacheReadTokens: totals.cacheReadTokens,
            cacheWriteTokens: totals.cacheWriteTokens,
            reasoningTokens: totals.reasoningTokens,
            totalCost: totals.totalCost,
          };
        })
        .sort((a, b) => b.totalTokens - a.totalTokens);

      return {
        overall: toPeriodStats("Total", overall),
        models,
      };
    },
  };
}

export function createOverallAccumulator(
  filters: FilterOptions,
): {
  consume(message: Message): void;
  result(): PeriodStats;
} {
  const parsedFilters = parseFilters(filters, true);
  const overall = createMutableStats();

  return {
    consume(message: Message): void {
      if (!matchesFilters(message, parsedFilters, true)) {
        return;
      }
      applyToMutableStats(overall, message);
    },
    result(): PeriodStats {
      return toPeriodStats("Total", overall);
    },
  };
}
