import type { FilterOptions, Message } from "./types";
import { formatLocalDate, parseLocalDateEnd, parseLocalDateStart } from "../shared/date-utils";
import { buildModelName } from "./aggregator-stats";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedFilters {
  model?: string;
  from?: number;
  to?: number;
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

export function parseFilters(filters: FilterOptions, includeModel: boolean): ParsedFilters {
  validateFilters(filters, includeModel);
  return {
    model: filters.model,
    from: parseDateStart(filters.from),
    to: parseDateEnd(filters.to),
  };
}

export function matchesFilters(message: Message, filters: ParsedFilters, includeModel: boolean): boolean {
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
