import { z } from "zod";

import type { Message } from "../core/types";

function nonNegativeNumber(): z.ZodNumber {
  return z.number().nonnegative();
}

const AssistantMessageSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  role: z.literal("assistant"),
  time: z.object({
    created: z.number(),
    completed: z.number().optional(),
  }),
  error: z
    .object({
      name: z.string(),
      data: z.record(z.string(), z.unknown()),
    })
    .optional(),
  parentID: z.string(),
  modelID: z.string(),
  providerID: z.string(),
  mode: z.string(),
  path: z.object({
    cwd: z.string(),
    root: z.string(),
  }),
  summary: z.boolean().optional(),
  cost: nonNegativeNumber(),
  tokens: z.object({
    total: nonNegativeNumber().optional(),
    input: nonNegativeNumber(),
    output: nonNegativeNumber(),
    reasoning: nonNegativeNumber(),
    cache: z.object({
      read: nonNegativeNumber(),
      write: nonNegativeNumber(),
    }),
  }),
  finish: z.string().optional(),
});

export function isValidAssistantMessage(value: unknown): value is Message {
  return AssistantMessageSchema.safeParse(value).success;
}
