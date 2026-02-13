import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as env from "../io/env";
import { forEachMessage } from "../io/loader";
import type { Message } from "../core/types";

function messageFixture(overrides: Partial<Message> & { id: string; sessionID: string; time: { created: number } }): Message {
  const { id, sessionID, time, ...rest } = overrides;
  return {
    id,
    sessionID,
    role: "assistant",
    time,
    parentID: "parent",
    modelID: "model",
    providerID: "provider",
    mode: "default",
    path: {
      cwd: "/tmp",
      root: "/tmp",
    },
    cost: 0.1,
    tokens: {
      input: 1,
      output: 2,
      reasoning: 3,
      cache: { read: 4, write: 5 },
    },
    ...rest,
  };
}

describe("forEachMessage", () => {
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "opencode-usage-test-"));
    vi.spyOn(env, "getDataDir").mockReturnValue(tempRoot);
    await mkdir(join(tempRoot, "message", "session-a"), { recursive: true });
    await mkdir(join(tempRoot, "message", "session-b"), { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("reads valid assistant messages, skips invalid data, and deduplicates", async () => {
    const valid1 = messageFixture({
      id: "id-1",
      sessionID: "session-a",
      time: { created: Date.parse("2026-01-02T00:00:00.000Z") },
    });
    const valid2 = messageFixture({
      id: "id-2",
      sessionID: "session-b",
      time: { created: Date.parse("2026-01-01T00:00:00.000Z") },
      tokens: {
        total: 999,
        input: 1,
        output: 2,
        reasoning: 3,
        cache: { read: 4, write: 5 },
      },
    });

    const duplicateId = messageFixture({
      id: "id-1",
      sessionID: "session-b",
      time: { created: Date.parse("2026-01-03T00:00:00.000Z") },
    });

    const userMessage = {
      ...messageFixture({ id: "id-user", sessionID: "session-a", time: { created: Date.now() } }),
      role: "user" as const,
    };

    const missingTokens = {
      id: "id-no-tokens",
      sessionID: "session-a",
      role: "assistant" as const,
      time: { created: Date.now() },
      parentID: "parent",
      modelID: "model",
      providerID: "provider",
      mode: "default",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0.1,
    };

    const missingPath = {
      id: "id-no-path",
      sessionID: "session-a",
      role: "assistant" as const,
      time: { created: Date.now() },
      parentID: "parent",
      modelID: "model",
      providerID: "provider",
      mode: "default",
      cost: 0.1,
      tokens: {
        input: 1,
        output: 2,
        reasoning: 3,
        cache: { read: 4, write: 5 },
      },
    };

    const negativeTokens = messageFixture({
      id: "id-negative-tokens",
      sessionID: "session-a",
      time: { created: Date.now() },
      tokens: {
        input: -1,
        output: 2,
        reasoning: 3,
        cache: { read: 4, write: 5 },
      },
    });

    const negativeCost = messageFixture({
      id: "id-negative-cost",
      sessionID: "session-a",
      time: { created: Date.now() },
      cost: -0.1,
    });

    const largeTokens = messageFixture({
      id: "id-large-tokens",
      sessionID: "session-a",
      time: { created: Date.now() },
      tokens: {
        input: 1_000_000_000_001,
        output: 2,
        reasoning: 3,
        cache: { read: 4, write: 5 },
      },
    });

    const largeCost = messageFixture({
      id: "id-large-cost",
      sessionID: "session-a",
      time: { created: Date.now() },
      cost: 1_000_001,
    });

    await writeFile(join(tempRoot, "message", "session-a", "01-valid.json"), JSON.stringify(valid1), "utf8");
    await writeFile(join(tempRoot, "message", "session-b", "02-valid.json"), JSON.stringify(valid2), "utf8");
    await writeFile(join(tempRoot, "message", "session-b", "03-duplicate.json"), JSON.stringify(duplicateId), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "04-user.json"), JSON.stringify(userMessage), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "05-no-tokens.json"), JSON.stringify(missingTokens), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "06-no-path.json"), JSON.stringify(missingPath), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "07-negative-tokens.json"), JSON.stringify(negativeTokens), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "08-negative-cost.json"), JSON.stringify(negativeCost), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "09-large-tokens.json"), JSON.stringify(largeTokens), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "10-large-cost.json"), JSON.stringify(largeCost), "utf8");
    await writeFile(join(tempRoot, "message", "session-a", "11-invalid.json"), "{ not-json", "utf8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const messages: Message[] = [];
    await forEachMessage((message) => {
      messages.push(message);
    });

    expect(messages).toHaveLength(4);
    expect(messages.map((m) => m.id).sort()).toEqual(["id-1", "id-2", "id-large-cost", "id-large-tokens"]);
    expect(messages.every((m) => m.role === "assistant")).toBe(true);
    expect(messages.every((m) => !!m.tokens)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("skipped unreadable message file"));
  });
});
