import { describe, expect, it, vi } from "vitest";
import { executeTask, type ExecutionCheckpoint } from "./execution-contract";

describe("LUXORA execution-first contract", () => {
  it("executes an authorised task instead of stopping at reassurance", async () => {
    const execute = vi.fn().mockResolvedValue({ projectId: "luxora-001" });
    const verify = vi.fn().mockResolvedValue(true);

    const outcome = await executeTask({
      taskId: "create-luxora-project",
      authorized: true,
      execute,
      verify,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith({ projectId: "luxora-001" });
    expect(outcome).toEqual({
      status: "COMPLETED",
      result: { projectId: "luxora-001" },
    });
  });

  it("does not repeat an approval request when authorisation is already granted", async () => {
    const execute = vi.fn().mockResolvedValue("sent");
    const outcome = await executeTask({
      taskId: "send-approved-message",
      authorized: true,
      execute,
      verify: async (result) => result === "sent",
    });

    expect(outcome.status).toBe("COMPLETED");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("stops before an action that requires new consequential approval", async () => {
    const execute = vi.fn();
    const outcome = await executeTask({
      taskId: "purchase-paid-service",
      authorized: true,
      requiresAdditionalApproval: true,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("NEEDS_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not claim success when verification returns false", async () => {
    const outcome = await executeTask({
      taskId: "create-record",
      authorized: true,
      execute: async () => ({ id: "record-1" }),
      verify: async () => false,
    });

    expect(outcome.status).toBe("UNVERIFIED");
    expect(outcome.result).toEqual({ id: "record-1" });
  });

  it("does not claim success when verification throws", async () => {
    const outcome = await executeTask({
      taskId: "publish-change",
      authorized: true,
      execute: async () => "submitted",
      verify: async () => {
        throw new Error("verification service unavailable");
      },
    });

    expect(outcome.status).toBe("UNVERIFIED");
  });

  it("preserves the blocker state when execution fails", async () => {
    const verify = vi.fn();
    const outcome = await executeTask({
      taskId: "create-project",
      authorized: true,
      execute: async () => {
        throw new Error("provider unavailable");
      },
      verify,
    });

    expect(outcome.status).toBe("BLOCKED");
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not repeat a previously verified completed task", async () => {
    const execute = vi.fn();
    const verify = vi.fn();
    const checkpoint: ExecutionCheckpoint<{ receipt: string }> = {
      taskId: "send-payment",
      status: "COMPLETED",
      result: { receipt: "RCP-123" },
      verified: true,
    };

    const outcome = await executeTask({
      taskId: "send-payment",
      authorized: true,
      previousCheckpoint: checkpoint,
      execute,
      verify,
    });

    expect(outcome).toEqual({
      status: "ALREADY_COMPLETED",
      result: { receipt: "RCP-123" },
    });
    expect(execute).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not reuse a checkpoint belonging to another task", async () => {
    const execute = vi.fn().mockResolvedValue("new-result");
    const outcome = await executeTask({
      taskId: "task-b",
      authorized: true,
      previousCheckpoint: {
        taskId: "task-a",
        status: "COMPLETED",
        result: "old-result",
        verified: true,
      },
      execute,
      verify: async (result) => result === "new-result",
    });

    expect(outcome).toEqual({ status: "COMPLETED", result: "new-result" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not execute when the task is not authorised", async () => {
    const execute = vi.fn();
    const outcome = await executeTask({
      taskId: "delete-account",
      authorized: false,
      execute,
      verify: async () => true,
    });

    expect(outcome.status).toBe("NEEDS_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
  });
});
