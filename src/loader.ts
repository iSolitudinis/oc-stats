import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { glob } from "tinyglobby";
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

export async function loadMessages(): Promise<Message[]> {
  const dataDir = getDataDir();
  const pattern = join(dataDir, "message", "**", "*.json").replace(/\\/g, "/");
  let files: string[];

  try {
    files = await glob(pattern, { onlyFiles: true, absolute: true });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Failed to scan OpenCode message files in ${dataDir}: ${reason}`);
  }

  const deduped = new Map<string, Message>();

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchMessages = await Promise.all(batch.map((filePath) => parseMessage(filePath)));

    for (const message of batchMessages) {
      if (!message) {
        continue;
      }
      if (!deduped.has(message.id)) {
        deduped.set(message.id, message);
      }
    }
  }

  return [...deduped.values()].sort((a, b) => a.time.created - b.time.created);
}
