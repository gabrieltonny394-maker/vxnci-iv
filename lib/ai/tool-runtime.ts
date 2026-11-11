import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type {
  TaskAuthorizationPolicy,
  TaskCheckpointStore,
  TaskExecutionScope,
} from "./task-orchestration";

export interface ServerToolRuntimeDependencies {
  scope: TaskExecutionScope;
  authorization: TaskAuthorizationPolicy;
  checkpoints: TaskCheckpointStore;
}

export type ServerToolRuntimeResolver = (
  request: NextRequest,
) => Promise<ServerToolRuntimeDependencies | null>;

/**
 * Installed only by trusted server bootstrap code. Never derive scope,
 * authorization decisions, or checkpoint ownership from request JSON.
 */
let resolver: ServerToolRuntimeResolver | null = null;

export function configureServerToolRuntimeResolver(
  nextResolver: ServerToolRuntimeResolver,
): void {
  if (resolver) {
    throw new Error("A server tool runtime resolver is already configured.");
  }
  resolver = nextResolver;
}

/** Test/process teardown hook; not exposed through any HTTP endpoint. */
export function resetServerToolRuntimeResolverForTests(): void {
  resolver = null;
}

export async function resolveServerToolRuntime(
  request: NextRequest,
): Promise<ServerToolRuntimeDependencies & { invocationId: string } | null> {
  if (!resolver) return null;

  try {
    const dependencies = await resolver(request);
    if (
      !dependencies ||
      !dependencies.scope.principalId ||
      !dependencies.scope.conversationId
    ) {
      return null;
    }

    return { ...dependencies, invocationId: randomUUID() };
  } catch {
    // Fail closed: no tool execution if identity or persistence cannot be resolved.
    return null;
  }
}
