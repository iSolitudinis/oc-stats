import { describe, expect, it } from "vitest";

import { formatLocalDate, getPeriodKey, parseLocalDateEnd, parseLocalDateStart } from "../shared/date-utils";
import { getDataDir } from "../io/env";
import { formatCost, formatNumber } from "../shared/format-utils";

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
  it("returns localized numeric output", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });
});

describe("formatCost", () => {
  it("returns USD currency output", () => {
    expect(formatCost(12.345)).toBe("$12.35");
  });
});

describe("getDataDir", () => {
  it("returns default storage directory", () => {
    const dataDir = getDataDir();
    expect(dataDir.endsWith(".local/share/opencode/storage")).toBe(true);
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
