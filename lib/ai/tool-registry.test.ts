import { describe, expect, it, vi } from "vitest";
import { ToolRegistry, type ToolInvocationContext } from "./tool-registry";
import type { TaskCheckpointStore } from "./task-orchestration";

type Args = { text: string };

function makeContext(overrides: Partial<ToolInvocationContext> = {}): ToolInvocationContext {
  const checkpoints: TaskCheckpointStore = {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
  return {
    scope: { principalId: "user-1", conversationId: "conversation-1" },
    authorization: { authorize: vi.fn().mockResolvedValue({ allowed: true }) },
    checkpoints,
    invocationId: "server-call-0001",
    ...overrides,
  };
}

function makeRegistry(execute = vi.fn().mockResolvedValue({ ok: true })) {
  const registry = new ToolRegistry();
  const verify = vi.fn().mockResolvedValue(true);
  registry.register<Args, { ok: boolean }>({
    name: "save_note",
    description: "Save a note for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", maxLength: 500 } },
      required: ["text"],
      additionalProperties: false,
    },
    parseArguments(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const candidate = value as Record<string, unknown>;
      if (typeof candidate.text !== "string" || !candidate.text.trim() ||
          candidate.text.length > 500 || Object.keys(candidate).some((key) => key !== "text")) {
        return null;
      }
      return { text: candidate.text };
    },
    execute,
    verify,
  });
  return { registry, execute, verify };
}

describe("server-owned tool registry", () => {
  it("exposes only prompt metadata, not executable handlers", () => {
    const { registry } = makeRegistry();
    expect(registry.listForPlanner()).toEqual([{
      name: "save_note",
      description: "Save a note for the authenticated user.",
      inputSchema: expect.objectContaining({ type: "object" }),
    }]);
  });

  it("validates untrusted model arguments before authorization or execution", async () => {
    const { registry, execute } = makeRegistry();
    const context = makeContext();
    const outcome = await registry.invoke({
      toolName: "save_note",
      arguments: { text: 42 },
    }, context);

    expect(outcome.status).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
    expect(context.authorization.authorize).not.toHaveBeenCalled();
  });

  it("does not invoke tools that are not registered by the server", async () => {
    const { registry, execute } = makeRegistry();
    const outcome = await registry.invoke({
      toolName: "delete_everything",
      arguments: {},
    }, makeContext());

    expect(outcome.status).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("authorizes and executes a validated call through verified task orchestration", async () => {
    const { registry, execute, verify } = makeRegistry();
    const context = makeContext();
    const outcome = await registry.invoke({
      toolName: "save_note",
      arguments: { text: "Remember this" },
    }, context);

    expect(outcome).toEqual({ status: "COMPLETED", result: { ok: true } });
    expect(context.authorization.authorize).toHaveBeenCalledWith({
      ...context.scope,
      taskId: "tool:save_note:server-call-0001",
      toolName: "save_note",
      arguments: { text: "Remember this" },
    });
    expect(execute).toHaveBeenCalledWith({ text: "Remember this" }, context.scope);
    expect(verify).toHaveBeenCalledWith({ text: "Remember this" }, { ok: true }, context.scope);
    expect(context.checkpoints.save).toHaveBeenCalled();
  });

  it("does not execute a call that requires additional approval", async () => {
    const { registry, execute } = makeRegistry();
    const context = makeContext({
      authorization: {
        authorize: vi.fn().mockResolvedValue({
          allowed: true,
          requiresAdditionalApproval: true,
        }),
      },
    });
    const outcome = await registry.invoke({
      toolName: "save_note",
      arguments: { text: "Sensitive action" },
    }, context);

    expect(outcome.status).toBe("NEEDS_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects invocation IDs that were not issued in server context", async () => {
    const { registry, execute } = makeRegistry();
    const outcome = await registry.invoke({
      toolName: "save_note",
      arguments: { text: "Hello" },
    }, makeContext({ invocationId: "x" }));

    expect(outcome.status).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
  });
});
