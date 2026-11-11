import {
  executeTask,
  type ExecutionCheckpoint,
  type ExecutionOutcome,
} from "./execution-contract";

export interface TaskExecutionScope {
  /** Must be derived from the authenticated server session. */
  principalId: string;
  /** Must be the conversation selected by that authenticated principal. */
  conversationId: string;
}

export interface TaskAuthorizationDecision {
  allowed: boolean;
  requiresAdditionalApproval?: boolean;
}

export interface TaskAuthorizationPolicy {
  authorize(input: TaskExecutionScope & { taskId: string }): Promise<TaskAuthorizationDecision>;
}

export interface TaskCheckpointStore {
  load<T>(scope: TaskExecutionScope, taskId: string): Promise<ExecutionCheckpoint<T> | null>;
  save<T>(scope: TaskExecutionScope, checkpoint: ExecutionCheckpoint<T>): Promise<void>;
}

export interface OrchestratedTask<T> {
  taskId: string;
  scope: TaskExecutionScope;
  authorization: TaskAuthorizationPolicy;
  checkpoints: TaskCheckpointStore;
  execute: () => Promise<T>;
  verify: (result: T) => Promise<boolean>;
}

/**
 * Server-side task execution entry point.
 *
 * The caller must derive scope from authenticated server state and supply
 * server-owned authorization/checkpoint adapters. Never pass scope or policy
 * decisions through untrusted request fields. Checkpoints must be isolated by
 * principal and conversation in the store implementation.
 */
export async function orchestrateTask<T>(
  request: OrchestratedTask<T>,
): Promise<ExecutionOutcome<T>> {
  if (!request.scope.principalId || !request.scope.conversationId || !request.taskId) {
    return { status: "BLOCKED", reason: "Authenticated task scope is unavailable." };
  }

  let decision: TaskAuthorizationDecision;
  try {
    decision = await request.authorization.authorize({
      ...request.scope,
      taskId: request.taskId,
    });
  } catch {
    return { status: "BLOCKED", reason: "Task authorization could not be checked." };
  }

  if (!decision.allowed || decision.requiresAdditionalApproval) {
    return executeTask({
      taskId: request.taskId,
      authorized: decision.allowed,
      requiresAdditionalApproval: decision.requiresAdditionalApproval,
      execute: request.execute,
      verify: request.verify,
    });
  }

  let previousCheckpoint: ExecutionCheckpoint<T> | null;
  try {
    previousCheckpoint = await request.checkpoints.load<T>(request.scope, request.taskId);
  } catch {
    return { status: "BLOCKED", reason: "Task progress could not be loaded safely." };
  }

  const outcome = await executeTask({
    taskId: request.taskId,
    authorized: decision.allowed,
    requiresAdditionalApproval: decision.requiresAdditionalApproval,
    previousCheckpoint,
    execute: request.execute,
    verify: request.verify,
  });

  if (outcome.status !== "COMPLETED") {
    return outcome;
  }

  try {
    await request.checkpoints.save(request.scope, {
      taskId: request.taskId,
      status: "COMPLETED",
      result: outcome.result as T,
      verified: true,
    });
    return outcome;
  } catch {
    return {
      status: "UNVERIFIED",
      result: outcome.result,
      reason: "The action was verified, but its completion checkpoint could not be saved safely.",
    };
  }
}
