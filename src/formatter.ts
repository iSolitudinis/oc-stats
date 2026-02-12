import chalk from "chalk";
import Table from "cli-table3";

import type { ModelStats, PeriodStats } from "./types";
import { formatCost, formatNumber } from "./utils";

function right(content: string): { content: string; hAlign: "right" } {
  return { content, hAlign: "right" };
}

const PERIOD_HEAD = [
  chalk.bold.cyan("Period"),
  chalk.bold.cyan("Requests"),
  chalk.bold.cyan("Input"),
  chalk.bold.cyan("Output"),
  chalk.bold.cyan("Cache Read"),
  chalk.bold.cyan("Cache Write"),
  chalk.bold.cyan("Cost"),
];

const COL_ALIGNS: Table.HorizontalAlignment[] = ["left", "right", "right", "right", "right", "right", "right"];

function periodRow(p: PeriodStats): Table.Cell[] {
  return [
    p.period,
    right(formatNumber(p.totalRequests)),
    right(formatNumber(p.inputTokens)),
    right(formatNumber(p.outputTokens)),
    right(formatNumber(p.cacheReadTokens)),
    right(formatNumber(p.cacheWriteTokens)),
    right(chalk.green(formatCost(p.totalCost))),
  ];
}

function totalRow(p: PeriodStats): Table.Cell[] {
  return [
    chalk.bold("Total"),
    right(chalk.bold(formatNumber(p.totalRequests))),
    right(chalk.bold(formatNumber(p.inputTokens))),
    right(chalk.bold(formatNumber(p.outputTokens))),
    right(chalk.bold(formatNumber(p.cacheReadTokens))),
    right(chalk.bold(formatNumber(p.cacheWriteTokens))),
    right(chalk.bold.green(formatCost(p.totalCost))),
  ];
}

export function formatTodaySummary(today: PeriodStats): string {
  const table = new Table({
    head: PERIOD_HEAD,
    colAligns: COL_ALIGNS,
  });

  table.push(periodRow(today));

  return `${chalk.bold.cyan("Today")}\n${table.toString()}`;
}

export function formatPeriodTable(overall: PeriodStats, periods: PeriodStats[]): string {
  const table = new Table({
    head: PERIOD_HEAD,
    colAligns: COL_ALIGNS,
  });

  if (periods.length === 0) {
    table.push(["-", right("0"), right("0"), right("0"), right("0"), right("0"), right(chalk.green(formatCost(0)))]);
  } else {
    for (const period of periods) {
      table.push(periodRow(period));
    }
  }

  table.push(totalRow(overall));

  return `${chalk.bold.cyan("Usage by Period")}\n${table.toString()}`;
}

export function formatModelTable(overall: PeriodStats, models: ModelStats[]): string {
  const table = new Table({
    head: [
      chalk.bold.cyan("Model"),
      chalk.bold.cyan("Requests"),
      chalk.bold.cyan("Input"),
      chalk.bold.cyan("Output"),
      chalk.bold.cyan("Cache Read"),
      chalk.bold.cyan("Cache Write"),
      chalk.bold.cyan("Cost"),
    ],
    colAligns: COL_ALIGNS,
  });

  if (models.length === 0) {
    table.push(["-", right("0"), right("0"), right("0"), right("0"), right("0"), right(chalk.green(formatCost(0)))]);
  } else {
    for (const model of models) {
      table.push([
        model.model,
        right(formatNumber(model.totalRequests)),
        right(formatNumber(model.inputTokens)),
        right(formatNumber(model.outputTokens)),
        right(formatNumber(model.cacheReadTokens)),
        right(formatNumber(model.cacheWriteTokens)),
        right(chalk.green(formatCost(model.totalCost))),
      ]);
    }
  }

  table.push(totalRow(overall));

  return `${chalk.bold.cyan("Model Breakdown")}\n${table.toString()}`;
}
