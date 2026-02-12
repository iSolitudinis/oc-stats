import { opendir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { Message } from "./types";
import { getDataDir } from "./utils";

const BATCH_SIZE = 50;
const MAX_TOKEN_VALUE = 1_000_000_000_000;
const MAX_COST_VALUE = 1_000_000;

function boundedNonNegativeNumber(max: number): z.ZodNumber {
  return z.number().nonnegative().max(max);
}

const AssistantMessageSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  role: z.literal("assistant"),
  time: z.object({
    created: z.number(),
    completed: z.number().optional(),
  }),
  modelID: z.string().optional(),
  providerID: z.string().optional(),
  cost: boundedNonNegativeNumber(MAX_COST_VALUE).optional(),
  tokens: z.object({
    input: boundedNonNegativeNumber(MAX_TOKEN_VALUE),
    output: boundedNonNegativeNumber(MAX_TOKEN_VALUE),
    reasoning: boundedNonNegativeNumber(MAX_TOKEN_VALUE),
    cache: z.object({
      read: boundedNonNegativeNumber(MAX_TOKEN_VALUE),
      write: boundedNonNegativeNumber(MAX_TOKEN_VALUE),
    }),
  }),
});

function isValidAssistantMessage(value: unknown): value is Message {
  return AssistantMessageSchema.safeParse(value).success;
}

async function parseMessage(filePath: string): Promise<Message | null> {
  try {
    const text = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (!isValidAssistantMessage(parsed)) {
      return null;
    }
    return parsed;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`Warning: skipped unreadable message file: ${filePath} (${reason})`);
    return null;
  }
}

async function* iterateJsonFiles(dirPath: string): AsyncGenerator<string> {
  let dir;

  try {
    dir = await opendir(dirPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for await (const entry of dir) {
    const entryPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      yield* iterateJsonFiles(entryPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      yield entryPath;
    }
  }
}

async function processBatch(
  files: string[],
  seenIds: Set<string>,
  visitor: (message: Message) => void | Promise<void>,
): Promise<void> {
  const batchMessages = await Promise.all(files.map((filePath) => parseMessage(filePath)));

  for (const message of batchMessages) {
    if (!message || seenIds.has(message.id)) {
      continue;
    }

    seenIds.add(message.id);
    await visitor(message);
  }
}

export async function forEachMessage(visitor: (message: Message) => void | Promise<void>): Promise<void> {
  const dataDir = getDataDir();
  const messageDir = join(dataDir, "message");

  const seenIds = new Set<string>();
  let files: string[] = [];

  try {
    for await (const filePath of iterateJsonFiles(messageDir)) {
      files.push(filePath);
      if (files.length < BATCH_SIZE) {
        continue;
      }

      await processBatch(files, seenIds, visitor);
      files = [];
    }

    if (files.length > 0) {
      await processBatch(files, seenIds, visitor);
    }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Failed to scan OpenCode message files in ${dataDir}: ${reason}`);
  }
}
