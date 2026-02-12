export function formatCliError(error: unknown): string[] {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.startsWith("Invalid date format:")) {
    return [
      "Error: Invalid date format",
      message,
      "Example: use --from 2026-02-01 and --to 2026-02-08",
    ];
  }

  if (message.startsWith("Invalid date value:")) {
    return ["Error: Invalid date value", message, "Use a real calendar date in YYYY-MM-DD format."];
  }

  if (message.startsWith("Invalid date range:")) {
    return ["Error: Invalid date range", message, "Ensure --from is on or before --to."];
  }

  if (message.startsWith("Invalid model filter:")) {
    return ["Error: Invalid model filter", message, "Provide --model as providerID/modelID."];
  }

  if (message.startsWith("Failed to scan OpenCode message files")) {
    return [
      "Error: Data loading failed",
      message,
      "Check OpenCode data directory and read permissions.",
    ];
  }

  return ["Error: Failed to run oc-stats", message, "Run `oc-stats --help` for usage information."];
}
