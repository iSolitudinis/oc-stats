import { z } from "zod";

import type { Message } from "../core/types";

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

export function isValidAssistantMessage(value: unknown): value is Message {
  return AssistantMessageSchema.safeParse(value).success;
}
