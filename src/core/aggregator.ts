import type { FilterOptions, Granularity, Message, ModelStats, PeriodStats } from "./types";
import { getPeriodKey } from "../shared/date-utils";
import { matchesFilters, parseFilters, validateFilters } from "./aggregator-filters";
import { applyToMutableStats, buildModelName, createMutableStats, type MutableStats, toPeriodStats } from "./aggregator-stats";

export { validateFilters };

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
