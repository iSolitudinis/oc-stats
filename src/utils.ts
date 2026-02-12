import { homedir } from "node:os";
import { join } from "node:path";
import { endOfDay, format, getISOWeek, getISOWeekYear, parse, startOfDay } from "date-fns";

import type { Granularity, Message } from "./types";

export function getDataDir(): string {
  return join(homedir(), ".local", "share", "opencode", "storage");
}

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

export function getActiveMinutes(messages: Message[]): number {
  if (messages.length === 0) {
    return 1;
  }

  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;

  for (const message of messages) {
    if (message.time.created < minTime) {
      minTime = message.time.created;
    }
    if (message.time.created > maxTime) {
      maxTime = message.time.created;
    }
  }

  const diffMinutes = (maxTime - minTime) / 60000;
  return Math.max(1, diffMinutes);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatCost(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
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
