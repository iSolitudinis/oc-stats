import { describe, expect, it } from "vitest";

import { formatModelTable, formatPeriodTable, formatTodaySummary } from "../cli/formatter";
import type { ModelStats, PeriodStats } from "../core/types";

function periodStats(overrides: Partial<PeriodStats> = {}): PeriodStats {
  return {
    period: "2026-01-01",
    totalRequests: 3,
    totalTokens: 600,
    inputTokens: 100,
    outputTokens: 200,
    cacheReadTokens: 250,
    cacheWriteTokens: 40,
    reasoningTokens: 10,
    totalCost: 12.34,
    ...overrides,
  };
}

function modelStats(overrides: Partial<ModelStats> = {}): ModelStats {
  return {
    model: "openai/gpt-5",
    totalRequests: 2,
    totalTokens: 500,
    inputTokens: 120,
    outputTokens: 180,
    cacheReadTokens: 160,
    cacheWriteTokens: 30,
    reasoningTokens: 10,
    totalCost: 3.21,
    ...overrides,
  };
}

describe("formatTodaySummary", () => {
  it("contains Today header and period values", () => {
    const today = periodStats({ period: "2026-02-08", totalRequests: 7, totalCost: 1.5 });
    const output = formatTodaySummary(today);

    expect(output).toContain("Today");
    expect(output).toContain("2026-02-08");
    expect(output).toContain("7");
    expect(output).toContain("$1.50");
  });

});

describe("formatPeriodTable", () => {
  it("contains Usage by Period header, Total row, and period data", () => {
    const overall = periodStats({ period: "Total", totalRequests: 10, totalCost: 99.99 });
    const periods = [periodStats({ period: "2026-01-01" }), periodStats({ period: "2026-01-02", totalRequests: 5 })];

    const output = formatPeriodTable(overall, periods);

    expect(output).toContain("Usage by Period");
    expect(output).toContain("Total");
    expect(output).toContain("2026-01-01");
    expect(output).toContain("2026-01-02");
    expect(output).toContain("$99.99");
  });

  it("shows fallback '-' row plus Total when periods are empty", () => {
    const overall = periodStats({ period: "Total", totalRequests: 0, totalCost: 0 });
    const output = formatPeriodTable(overall, []);

    expect(output).toContain("Usage by Period");
    expect(output).toContain("-");
    expect(output).toContain("Total");
  });
});

describe("formatModelTable", () => {
  it("contains Model Breakdown header, Total row, and model names", () => {
    const overall = periodStats({ period: "Total", totalRequests: 4, totalCost: 8.88 });
    const models = [modelStats({ model: "openai/gpt-5" }), modelStats({ model: "anthropic/claude-3.5" })];

    const output = formatModelTable(overall, models);

    expect(output).toContain("Model Breakdown");
    expect(output).toContain("Total");
    expect(output).toContain("openai/gpt-5");
    expect(output).toContain("anthropic/claude-3.5");
    expect(output).toContain("$8.88");
  });

  it("shows fallback '-' row plus Total when models are empty", () => {
    const overall = periodStats({ period: "Total", totalRequests: 0, totalCost: 0 });
    const output = formatModelTable(overall, []);

    expect(output).toContain("Model Breakdown");
    expect(output).toContain("-");
    expect(output).toContain("Total");
  });

});
