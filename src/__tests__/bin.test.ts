import { describe, expect, it } from "vitest";

import { runCli } from "../bin";
import { formatCliError } from "../cli-error";

describe("runCli", () => {
  it("rejects invalid date format", async () => {
    await expect(runCli(["node", "oc-stats", "daily", "--from", "2026/01/01"]))
      .rejects.toThrow("Invalid date format");
  });

  it("rejects impossible date values", async () => {
    await expect(runCli(["node", "oc-stats", "daily", "--from", "2026-02-30"]))
      .rejects.toThrow("Invalid date value");
  });

  it("rejects reversed date range", async () => {
    await expect(runCli(["node", "oc-stats", "daily", "--from", "2026-02-01", "--to", "2026-01-31"]))
      .rejects.toThrow("Invalid date range");
  });

  it("rejects empty model filter", async () => {
    await expect(runCli(["node", "oc-stats", "models", "--model", "   "]))
      .rejects.toThrow("Invalid model filter");
  });

  it("strips standalone -- from forwarded argv", async () => {
    await expect(runCli(["node", "oc-stats", "--", "daily", "--from", "2026/01/01"]))
      .rejects.toThrow("Invalid date format");
  });
});

describe("formatCliError", () => {
  it("formats known validation errors", () => {
    expect(formatCliError(new Error("Invalid date format: bad"))).toEqual([
      "Error: Invalid date format",
      "Invalid date format: bad",
      "Example: use --from 2026-02-01 and --to 2026-02-08",
    ]);

    expect(formatCliError(new Error("Invalid date value: bad"))).toEqual([
      "Error: Invalid date value",
      "Invalid date value: bad",
      "Use a real calendar date in YYYY-MM-DD format.",
    ]);

    expect(formatCliError(new Error("Invalid date range: bad"))).toEqual([
      "Error: Invalid date range",
      "Invalid date range: bad",
      "Ensure --from is on or before --to.",
    ]);
  });

  it("formats fallback errors", () => {
    expect(formatCliError(new Error("boom"))).toEqual([
      "Error: Failed to run oc-stats",
      "boom",
      "Run `oc-stats --help` for usage information.",
    ]);
  });
});
