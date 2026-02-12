import { describe, expect, it } from "vitest";

import {
  createModelAccumulator,
  createOverallAccumulator,
  createPeriodAccumulator,
  validateFilters,
} from "../core/aggregator";
import type { FilterOptions, Message } from "../core/types";

function mockMessage(
  overrides: Partial<Message> & { id: string; sessionID: string; time: { created: number } },
): Message {
  return {
    role: "assistant",
    modelID: "test-model",
    providerID: "test-provider",
    cost: 0.01,
    tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 200, write: 0 } },
    ...overrides,
  };
}

describe("aggregate", () => {
  const noFilters: FilterOptions = {};

  function aggregate(messages: Message[], granularity: "daily" | "weekly" | "monthly" | "yearly", filters: FilterOptions) {
    const accumulator = createPeriodAccumulator(granularity, filters);
    for (const message of messages) {
      accumulator.consume(message);
    }
    return accumulator.result().periods;
  }

  it("groups by daily period and returns sorted periods", () => {
    const messages = [
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 0, 2, 10).getTime() } }),
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2026, 0, 1, 10).getTime() } }),
      mockMessage({ id: "m3", sessionID: "s", time: { created: new Date(2026, 0, 1, 11).getTime() } }),
    ];

    const result = aggregate(messages, "daily", noFilters);

    expect(result.map((item) => item.period)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(result[0]?.totalRequests).toBe(2);
    expect(result[1]?.totalRequests).toBe(1);
  });

  it("groups by weekly period", () => {
    const messages = [
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2026, 0, 1, 10).getTime() } }),
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 0, 3, 10).getTime() } }),
      mockMessage({ id: "m3", sessionID: "s", time: { created: new Date(2026, 0, 10, 10).getTime() } }),
    ];

    const result = aggregate(messages, "weekly", noFilters);
    expect(result.map((item) => item.period)).toEqual(["2026-W01", "2026-W02"]);
    expect(result[0]?.totalRequests).toBe(2);
    expect(result[1]?.totalRequests).toBe(1);
  });

  it("groups by monthly period", () => {
    const messages = [
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2026, 0, 10, 10).getTime() } }),
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 1, 10, 10).getTime() } }),
    ];

    const result = aggregate(messages, "monthly", noFilters);
    expect(result.map((item) => item.period)).toEqual(["2026-01", "2026-02"]);
  });

  it("groups by yearly period", () => {
    const messages = [
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2025, 11, 31, 10).getTime() } }),
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 0, 1, 10).getTime() } }),
    ];

    const result = aggregate(messages, "yearly", noFilters);
    expect(result.map((item) => item.period)).toEqual(["2025", "2026"]);
  });

  it("returns empty array when no messages", () => {
    expect(aggregate([], "daily", noFilters)).toEqual([]);
  });

  it("applies model filter", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 10).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "anthropic",
        modelID: "claude",
        time: { created: new Date(2026, 0, 1, 11).getTime() },
      }),
    ];

    const result = aggregate(messages, "daily", { model: "openai/gpt-5" });
    expect(result).toHaveLength(1);
    expect(result[0]?.totalRequests).toBe(1);
  });

  it("applies date range boundaries", () => {
    const messages = [
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2025, 11, 31, 23, 59, 59, 999).getTime() } }),
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 0, 1, 0, 0, 0).getTime() } }),
      mockMessage({ id: "m3", sessionID: "s", time: { created: new Date(2026, 0, 31, 23, 59, 59, 999).getTime() } }),
      mockMessage({ id: "m4", sessionID: "s", time: { created: new Date(2026, 1, 1, 0, 0, 0).getTime() } }),
    ];

    const result = aggregate(messages, "daily", { from: "2026-01-01", to: "2026-01-31" });
    expect(result.map((item) => item.period)).toEqual(["2026-01-01", "2026-01-31"]);
  });

  it("applies combined model and date filters", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 5, 12).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 1, 5, 12).getTime() },
      }),
      mockMessage({
        id: "m3",
        sessionID: "s",
        providerID: "anthropic",
        modelID: "claude",
        time: { created: new Date(2026, 0, 5, 12).getTime() },
      }),
    ];

    const result = aggregate(messages, "daily", {
      model: "openai/gpt-5",
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.period).toBe("2026-01-05");
    expect(result[0]?.totalRequests).toBe(1);
  });
});

describe("aggregateByModel", () => {
  function aggregateByModel(messages: Message[], filters: FilterOptions) {
    const accumulator = createModelAccumulator(filters);
    for (const message of messages) {
      accumulator.consume(message);
    }
    return accumulator.result().models;
  }

  it("groups by providerID/modelID and sorts by totalTokens desc", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 10).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 11).getTime() },
      }),
      mockMessage({
        id: "m3",
        sessionID: "s",
        providerID: "anthropic",
        modelID: "claude",
        tokens: { input: 1, output: 1, reasoning: 1, cache: { read: 1, write: 1 } },
        time: { created: new Date(2026, 0, 1, 12).getTime() },
      }),
    ];

    const result = aggregateByModel(messages, {});
    expect(result.map((item) => item.model)).toEqual(["openai/gpt-5", "anthropic/claude"]);
    expect(result[0]?.totalRequests).toBe(2);
    expect(result[1]?.totalRequests).toBe(1);
  });

  it("applies model filter", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 10).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "anthropic",
        modelID: "claude",
        time: { created: new Date(2026, 0, 1, 11).getTime() },
      }),
    ];

    const result = aggregateByModel(messages, { model: "anthropic/claude" });
    expect(result).toHaveLength(1);
    expect(result[0]?.model).toBe("anthropic/claude");
  });

  it("applies date filter", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2025, 11, 31, 23, 59, 59, 999).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 0, 0, 0).getTime() },
      }),
    ];

    const result = aggregateByModel(messages, { from: "2026-01-01", to: "2026-01-01" });
    expect(result).toHaveLength(1);
    expect(result[0]?.totalRequests).toBe(1);
  });

  it("returns empty array for empty messages", () => {
    expect(aggregateByModel([], {})).toEqual([]);
  });
});

describe("calculateOverall", () => {
  function calculateOverall(messages: Message[], filters: FilterOptions) {
    const accumulator = createOverallAccumulator(filters);
    for (const message of messages) {
      accumulator.consume(message);
    }
    return accumulator.result();
  }

  it("sums tokens, cost, and requests correctly", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        cost: 1.25,
        tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } },
        time: { created: new Date(2026, 0, 1, 10).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        cost: 2.75,
        tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } },
        time: { created: new Date(2026, 0, 2, 10).getTime() },
      }),
    ];

    const overall = calculateOverall(messages, {});
    expect(overall.period).toBe("Total");
    expect(overall.totalRequests).toBe(2);
    expect(overall.inputTokens).toBe(11);
    expect(overall.outputTokens).toBe(22);
    expect(overall.reasoningTokens).toBe(33);
    expect(overall.cacheReadTokens).toBe(44);
    expect(overall.cacheWriteTokens).toBe(55);
    expect(overall.totalTokens).toBe(165);
    expect(overall.totalCost).toBe(4);
  });

  it("applies model filter", () => {
    const messages = [
      mockMessage({
        id: "m1",
        sessionID: "s",
        providerID: "openai",
        modelID: "gpt-5",
        time: { created: new Date(2026, 0, 1, 10).getTime() },
      }),
      mockMessage({
        id: "m2",
        sessionID: "s",
        providerID: "anthropic",
        modelID: "claude",
        time: { created: new Date(2026, 0, 1, 11).getTime() },
      }),
    ];

    const overall = calculateOverall(messages, { model: "openai/gpt-5" });
    expect(overall.totalRequests).toBe(1);
  });

  it("applies date filter", () => {
    const messages = [
      mockMessage({ id: "m1", sessionID: "s", time: { created: new Date(2025, 11, 31, 23, 59, 59, 999).getTime() } }),
      mockMessage({ id: "m2", sessionID: "s", time: { created: new Date(2026, 0, 1, 12).getTime() } }),
      mockMessage({ id: "m3", sessionID: "s", time: { created: new Date(2026, 0, 2, 0, 0, 0).getTime() } }),
    ];

    const overall = calculateOverall(messages, { from: "2026-01-01", to: "2026-01-01" });
    expect(overall.totalRequests).toBe(1);
  });

  it("returns all zeros for empty input", () => {
    const overall = calculateOverall([], {});
    expect(overall).toEqual({
      period: "Total",
      totalRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalCost: 0,
    });
  });
});

describe("validateFilters", () => {
  it("throws on invalid date format", () => {
    expect(() => validateFilters({ from: "2026/01/01" }, true)).toThrow("Invalid date format");
  });

  it("throws on impossible date", () => {
    expect(() => validateFilters({ from: "2026-02-30" }, true)).toThrow("Invalid date value");
  });

  it("throws on reversed date range", () => {
    expect(() => validateFilters({ from: "2026-02-01", to: "2026-01-31" }, true)).toThrow("Invalid date range");
  });

  it("throws on empty model filter", () => {
    expect(() => validateFilters({ model: "   " }, true)).toThrow("Invalid model filter");
  });

  it("allows valid filters", () => {
    expect(() => validateFilters({ model: "openai/gpt-5", from: "2026-01-01", to: "2026-01-31" }, true)).not.toThrow();
  });
});
