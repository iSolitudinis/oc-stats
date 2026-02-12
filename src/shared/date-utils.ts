import { endOfDay, format, getISOWeek, getISOWeekYear, parse, startOfDay } from "date-fns";

import type { Granularity } from "../core/types";

export function getPeriodKey(timestamp: number, granularity: Granularity): string {
  const date = new Date(timestamp);

  if (granularity === "daily") {
    return format(date, "yyyy-MM-dd");
  }

  if (granularity === "weekly") {
    const weekYear = getISOWeekYear(date);
    const week = getISOWeek(date).toString().padStart(2, "0");
    return `${weekYear}-W${week}`;
  }

  if (granularity === "monthly") {
    return format(date, "yyyy-MM");
  }

  return format(date, "yyyy");
}

export function formatLocalDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseLocalDateStart(date: string): number {
  const parsed = parse(date, "yyyy-MM-dd", new Date());
  return startOfDay(parsed).getTime();
}

export function parseLocalDateEnd(date: string): number {
  const parsed = parse(date, "yyyy-MM-dd", new Date());
  return endOfDay(parsed).getTime();
}
