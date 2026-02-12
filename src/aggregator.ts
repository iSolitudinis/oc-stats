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

function createTokenTotals(): TokenTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
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

function filterMessages(messages: Message[], filters: FilterOptions, includeModel: boolean): Message[] {
  validateFilters(filters, includeModel);
  const from = parseDateStart(filters.from);
  const to = parseDateEnd(filters.to);

  return messages.filter((message) => {
    if (includeModel && filters.model && buildModelName(message) !== filters.model) {
      return false;
    }
    if (from !== undefined && message.time.created < from) {
      return false;
    }
    if (to !== undefined && message.time.created > to) {
      return false;
    }
    return true;
  });
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

function calculatePeriodStats(period: string, messages: Message[]): PeriodStats {
  const totals = createTokenTotals();
  let totalCost = 0;

  for (const message of messages) {
    applyMessageTotals(totals, message);
    totalCost += message.cost ?? 0;
  }

  const totalTokens = messages.reduce((sum, message) => sum + sumTokens(message), 0);

  return {
    period,
    totalRequests: messages.length,
    totalTokens,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cacheReadTokens: totals.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens,
    reasoningTokens: totals.reasoningTokens,
    totalCost,
  };
}

export function aggregate(messages: Message[], granularity: Granularity, filters: FilterOptions): PeriodStats[] {
  const filtered = filterMessages(messages, filters, true);
  const grouped = new Map<string, Message[]>();

  for (const message of filtered) {
    const period = getPeriodKey(message.time.created, granularity);
    const existing = grouped.get(period);
    if (existing) {
      existing.push(message);
    } else {
      grouped.set(period, [message]);
    }
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, groupMessages]) => calculatePeriodStats(period, groupMessages));
}

export function aggregateByModel(messages: Message[], filters: FilterOptions): ModelStats[] {
  const filtered = filterMessages(messages, filters, true);
  const grouped = new Map<string, Message[]>();

  for (const message of filtered) {
    const model = buildModelName(message);
    const existing = grouped.get(model);
    if (existing) {
      existing.push(message);
    } else {
      grouped.set(model, [message]);
    }
  }

  return [...grouped.entries()]
    .map(([model, groupMessages]) => {
      const totals = createTokenTotals();
      let totalCost = 0;

      for (const message of groupMessages) {
        applyMessageTotals(totals, message);
        totalCost += message.cost ?? 0;
      }

      const totalTokens = groupMessages.reduce((sum, message) => sum + sumTokens(message), 0);

      return {
        model,
        totalRequests: groupMessages.length,
        totalTokens,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        cacheWriteTokens: totals.cacheWriteTokens,
        reasoningTokens: totals.reasoningTokens,
        totalCost,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

export function calculateOverall(messages: Message[], filters: FilterOptions): PeriodStats {
  const filtered = filterMessages(messages, filters, true);
  return calculatePeriodStats("Total", filtered);
}
