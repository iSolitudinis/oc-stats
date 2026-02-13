import type { Message, PeriodStats } from "./types";

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface MutableStats extends TokenTotals {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
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

export function createMutableStats(): MutableStats {
  return {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    ...createTokenTotals(),
  };
}

function sumTokens(message: Message): number {
  return (
    message.tokens.input +
    message.tokens.output +
    message.tokens.reasoning +
    message.tokens.cache.read +
    message.tokens.cache.write
  );
}

function applyMessageTotals(totals: TokenTotals, message: Message): void {
  totals.inputTokens += message.tokens.input;
  totals.outputTokens += message.tokens.output;
  totals.reasoningTokens += message.tokens.reasoning;
  totals.cacheReadTokens += message.tokens.cache.read;
  totals.cacheWriteTokens += message.tokens.cache.write;
}

export function applyToMutableStats(totals: MutableStats, message: Message): void {
  totals.totalRequests += 1;
  applyMessageTotals(totals, message);
  totals.totalTokens += sumTokens(message);
  totals.totalCost += message.cost;
}

export function toPeriodStats(period: string, totals: MutableStats): PeriodStats {
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

export function buildModelName(message: Message): string {
  return `${message.providerID}/${message.modelID}`;
}
