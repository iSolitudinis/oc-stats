import { describe, expect, it } from "vitest";

import type { Message } from "../types";
import {
  formatCost,
  formatLocalDate,
  formatNumber,
  getActiveMinutes,
  getDataDir,
  getPeriodKey,
  parseLocalDateEnd,
  parseLocalDateStart,
} from "../utils";

describe("getPeriodKey", () => {
  it("returns daily key in YYYY-MM-DD format", () => {
    const timestamp = new Date(2026, 2, 15, 12, 34, 56).getTime();
    expect(getPeriodKey(timestamp, "daily")).toBe("2026-03-15");
  });

  it("returns weekly key in YYYY-Www format", () => {
    const timestamp = new Date(2026, 2, 15, 12, 34, 56).getTime();
    expect(getPeriodKey(timestamp, "weekly")).toBe("2026-W11");
  });

  it("returns monthly key in YYYY-MM format", () => {
    const timestamp = new Date(2026, 2, 15, 12, 34, 56).getTime();
    expect(getPeriodKey(timestamp, "monthly")).toBe("2026-03");
  });

  it("returns yearly key in YYYY format", () => {
    const timestamp = new Date(2026, 2, 15, 12, 34, 56).getTime();
    expect(getPeriodKey(timestamp, "yearly")).toBe("2026");
  });

  it("handles year boundary for daily keys", () => {
    const dec31 = new Date(2025, 11, 31, 23, 59, 59).getTime();
    const jan1 = new Date(2026, 0, 1, 0, 0, 0).getTime();

    expect(getPeriodKey(dec31, "daily")).toBe("2025-12-31");
    expect(getPeriodKey(jan1, "daily")).toBe("2026-01-01");
  });

  it("handles ISO week at year boundary", () => {
    const jan1_2026 = new Date(2026, 0, 1, 12, 0, 0).getTime();
    expect(getPeriodKey(jan1_2026, "weekly")).toBe("2026-W01");
  });
});

describe("formatNumber", () => {
  it("formats integers and decimals", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(12.5)).toBe("12.5");
  });
});

describe("formatCost", () => {
  it("formats currency with two decimals", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(12.345)).toBe("$12.35");
    expect(formatCost(0.001)).toBe("$0.00");
  });
});

describe("getDataDir", () => {
  it("returns default storage directory", () => {
    const dataDir = getDataDir();
    expect(dataDir.endsWith(".local/share/opencode/storage")).toBe(true);
  });
});

describe("getActiveMinutes", () => {
  function createMessage(created: number): Message {
    return {
      id: `id-${created}`,
      sessionID: "session-1",
      role: "assistant",
      time: { created },
      modelID: "m",
      providerID: "p",
      cost: 0,
      tokens: {
        input: 1,
        output: 1,
        reasoning: 1,
        cache: { read: 0, write: 0 },
      },
    };
  }

  it("returns minimum 1 for empty and very short spans", () => {
    expect(getActiveMinutes([])).toBe(1);

    const now = new Date(2026, 0, 1, 0, 0, 0).getTime();
    expect(getActiveMinutes([createMessage(now)])).toBe(1);
    expect(getActiveMinutes([createMessage(now), createMessage(now + 30_000)])).toBe(1);
  });

  it("returns minute difference for wider spans", () => {
    const start = new Date(2026, 0, 1, 0, 0, 0).getTime();
    const end = start + 5 * 60_000;
    expect(getActiveMinutes([createMessage(start), createMessage(end)])).toBe(5);
  });
});

describe("formatLocalDate", () => {
  it("formats date as YYYY-MM-DD in local time", () => {
    expect(formatLocalDate(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseLocalDateStart", () => {
  it("returns local midnight timestamp", () => {
    const ts = parseLocalDateStart("2026-03-15");
    const date = new Date(ts);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });
});

describe("parseLocalDateEnd", () => {
  it("returns local end-of-day timestamp", () => {
    const ts = parseLocalDateEnd("2026-03-15");
    const date = new Date(ts);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });
});
