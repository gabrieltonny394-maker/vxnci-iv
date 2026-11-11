import { describe, expect, it, vi } from "vitest";
import { orchestrateTask, type TaskCheckpointStore, type TaskExecutionScope } from "./task-orchestration";

const scope: TaskExecutionScope = {
  principalId: "user-1",
  conversationId: "conversation-1",
};

function makeStore(): TaskCheckpointStore {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("LUXORA task orchestration", () => {
  it("authorizes, executes, verifies, and persists a successful task", async () => {
    const checkpoints = makeStore();
    const execute = vi.fn().mockResolvedValue({ resourceId: "resource-1" });
    const verify = vi.fn().mockResolvedValue(true);
    const authorize = vi.fn().mockResolvedValue({ allowed: true });

    const outcome = await orchestrateTask({
      taskId: "create-resource",
      scope,
      authorization: { authorize },
      checkpoints,
      execute,
      verify,
    });

    expect(outcome).toEqual({
      status: "COMPLETED",
      result: { resourceId: "resource-1" },
    });
    expect(authorize).toHaveBeenCalledWith({ ...scope, taskId: "create-resource" });
    expect(checkpoints.load).toHaveBeenCalledWith(scope, "create-resource");
    expect(checkpoints.save).toHaveBeenCalledWith(scope, {
      taskId: "create-resource",
      status: "COMPLETED",
      result: { resourceId: "resource-1" },
      verified: true,
    });
  });

  it("does not execute when server authorization denies the task", async () => {
    const checkpoints = makeStore();
    const execute = vi.fn();

    const outcome = await orchestrateTask({
      taskId: "delete-resource",
      scope,
      authorization: { authorize: async () => ({ allowed: false }) },
      checkpoints,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("NEEDS_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
    expect(checkpoints.load).not.toHaveBeenCalled();
  });

  it("does not execute when a new consequential approval is required", async () => {
    const checkpoints = makeStore();
    const execute = vi.fn();

    const outcome = await orchestrateTask({
      taskId: "buy-service",
      scope,
      authorization: {
        authorize: async () => ({ allowed: true, requiresAdditionalApproval: true }),
      },
      checkpoints,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("NEEDS_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns an existing verified checkpoint without repeating the task", async () => {
    const checkpoints: TaskCheckpointStore = {
      load: vi.fn().mockResolvedValue({
        taskId: "send-message",
        status: "COMPLETED",
        result: { receipt: "receipt-1" },
        verified: true,
      }),
      save: vi.fn(),
    };
    const execute = vi.fn();

    const outcome = await orchestrateTask({
      taskId: "send-message",
      scope,
      authorization: { authorize: async () => ({ allowed: true }) },
      checkpoints,
      execute,
      verify: async () => true,
    });

    expect(outcome).toEqual({
      status: "ALREADY_COMPLETED",
      result: { receipt: "receipt-1" },
    });
    expect(execute).not.toHaveBeenCalled();
    expect(checkpoints.save).not.toHaveBeenCalled();
  });

  it("does not claim completion if checkpoint persistence fails", async () => {
    const checkpoints: TaskCheckpointStore = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    };

    const outcome = await orchestrateTask({
      taskId: "create-record",
      scope,
      authorization: { authorize: async () => ({ allowed: true }) },
      checkpoints,
      execute: async () => ({ id: "record-1" }),
      verify: async () => true,
    });

    expect(outcome.status).toBe("UNVERIFIED");
  });

  it("does not execute if the checkpoint store cannot load progress", async () => {
    const checkpoints: TaskCheckpointStore = {
      load: vi.fn().mockRejectedValue(new Error("storage unavailable")),
      save: vi.fn(),
    };
    const execute = vi.fn();

    const outcome = await orchestrateTask({
      taskId: "create-record",
      scope,
      authorization: { authorize: async () => ({ allowed: true }) },
      checkpoints,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not execute if authorization cannot be checked", async () => {
    const checkpoints = makeStore();
    const execute = vi.fn();

    const outcome = await orchestrateTask({
      taskId: "create-record",
      scope,
      authorization: {
        authorize: async () => {
          throw new Error("policy service unavailable");
        },
      },
      checkpoints,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("BLOCKED");
    expect(execute).not.toHaveBeenCalled();
  });
});


describe("void task checkpointing", () => {
  it("persists a verified task even when its action returns undefined", async () => {
    const checkpoints = makeStore();

    const outcome = await orchestrateTask<void>({
      taskId: "refresh-index",
      scope,
      authorization: { authorize: async () => ({ allowed: true }) },
      checkpoints,
      execute: async () => undefined,
      verify: async () => true,
    });

    expect(outcome.status).toBe("COMPLETED");
    expect(checkpoints.save).toHaveBeenCalledWith(scope, {
      taskId: "refresh-index",
      status: "COMPLETED",
      result: undefined,
      verified: true,
    });
  });
});
