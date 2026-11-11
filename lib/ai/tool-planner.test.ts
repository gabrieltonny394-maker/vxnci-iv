import { describe, expect, it, vi } from "vitest";
import { runPlannedTurn, type ToolPlanner } from "./tool-planner";
import { ToolRegistry } from "./tool-registry";
import type { ToolInvocationContext } from "./tool-registry";

function setup() {
  const registry = new ToolRegistry();
  const execute = vi.fn().mockResolvedValue({ saved: true });
  registry.register<{ value: string }, { saved: boolean }>({
    name: "save_value",
    description: "Save a value.",
    inputSchema: { type: "object" },
    parseArguments(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const candidate = value as Record<string, unknown>;
      return typeof candidate.value === "string" ? { value: candidate.value } : null;
    },
    execute,
    verify: async () => true,
  });

  const context: ToolInvocationContext = {
    scope: { principalId: "user-1", conversationId: "conversation-1" },
    authorization: { authorize: async () => ({ allowed: true }) },
    checkpoints: {
      load: async () => null,
      save: async () => undefined,
    },
    invocationId: "server-turn-0001",
  };
  const messages = [{ role: "user" as const, content: "Save hello" }];
  return { registry, execute, context, messages };
}

describe("tool planner boundary", () => {
  it("returns ordinary assistant text without invoking a tool", async () => {
    const { registry, execute, context, messages } = setup();
    const planner: ToolPlanner = {
      plan: async () => ({ type: "message", content: "Here is the answer." }),
    };
    const outcome = await runPlannedTurn({ planner, registry, messages, context });

    expect(outcome).toEqual({ type: "message", content: "Here is the answer." });
    expect(execute).not.toHaveBeenCalled();
  });

  it("routes a planned tool call through the server registry", async () => {
    const { registry, execute, context, messages } = setup();
    const planner: ToolPlanner = {
      plan: async ({ tools }) => {
        expect(tools.map((tool) => tool.name)).toEqual(["save_value"]);
        return { type: "tool_call", toolName: "save_value", arguments: { value: "hello" } };
      },
    };
    const outcome = await runPlannedTurn({ planner, registry, messages, context });

    expect(outcome).toEqual({
      type: "tool_result",
      outcome: { status: "COMPLETED", result: { saved: true } },
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("rejects malformed planner output without invoking a tool", async () => {
    const { registry, execute, context, messages } = setup();
    const planner: ToolPlanner = { plan: async () => ({ type: "tool_call", toolName: "" }) };
    const outcome = await runPlannedTurn({ planner, registry, messages, context });

    expect(outcome.type).toBe("invalid_plan");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not allow the planner to override trusted execution context", async () => {
    const { registry, execute, context, messages } = setup();
    const planner: ToolPlanner = {
      plan: async () => ({
        type: "tool_call",
        toolName: "save_value",
        arguments: { value: "hello" },
        principalId: "attacker",
        authorized: true,
        invocationId: "model-chosen-id",
      }),
    };
    const outcome = await runPlannedTurn({ planner, registry, messages, context });

    expect(outcome.type).toBe("tool_result");
    expect(execute).toHaveBeenCalledWith(
      { value: "hello" },
      { principalId: "user-1", conversationId: "conversation-1" },
    );
  });

  it("stops after one tool call rather than running an unbounded agent loop", async () => {
    const { registry, execute, context, messages } = setup();
    const planner: ToolPlanner = {
      plan: async () => ({ type: "tool_call", toolName: "save_value", arguments: { value: "one" } }),
    };
    const outcome = await runPlannedTurn({ planner, registry, messages, context });

    expect(outcome.type).toBe("tool_result");
    expect(execute).toHaveBeenCalledOnce();
  });
});
