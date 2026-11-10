export type ExecutionStatus =
  | "COMPLETED"
  | "NEEDS_APPROVAL"
  | "BLOCKED"
  | "UNVERIFIED"
  | "ALREADY_COMPLETED";

export interface ExecutionCheckpoint<T> {
  taskId: string;
  status: "COMPLETED";
  result: T;
  verified: true;
}

export interface ExecutionOutcome<T> {
  status: ExecutionStatus;
  result?: T;
  reason?: string;
}

export interface ExecutionRequest<T> {
  taskId: string;
  authorized: boolean;
  requiresAdditionalApproval?: boolean;
  previousCheckpoint?: ExecutionCheckpoint<T> | null;
  execute: () => Promise<T>;
  verify: (result: T) => Promise<boolean>;
}

/**
 * Executes an already-authorized task once, verifies its result, and reuses a
 * verified completion checkpoint rather than repeating a non-idempotent action.
 *
 * This is an execution contract/harness, not an LLM planner or external tool
 * integration. Callers must derive authorization from trusted server-side
 * policy, never from a client-supplied owner or approval flag.
 */
export async function executeTask<T>(
  request: ExecutionRequest<T>,
): Promise<ExecutionOutcome<T>> {
  if (
    request.previousCheckpoint?.taskId === request.taskId &&
    request.previousCheckpoint.verified
  ) {
    return {
      status: "ALREADY_COMPLETED",
      result: request.previousCheckpoint.result,
    };
  }

  if (!request.authorized || request.requiresAdditionalApproval) {
    return {
      status: "NEEDS_APPROVAL",
      reason: request.requiresAdditionalApproval
        ? "This action requires additional approval."
        : "The task is not authorised.",
    };
  }

  let result: T;
  try {
    result = await request.execute();
  } catch {
    return {
      status: "BLOCKED",
      reason: "The action could not be completed. Preserve prior progress and resolve the reported blocker.",
    };
  }

  try {
    const verified = await request.verify(result);
    if (!verified) {
      return {
        status: "UNVERIFIED",
        result,
        reason: "The action ran, but its outcome could not be verified.",
      };
    }
  } catch {
    return {
      status: "UNVERIFIED",
      result,
      reason: "The verification check failed; completion must not be claimed.",
    };
  }

  return { status: "COMPLETED", result };
}
