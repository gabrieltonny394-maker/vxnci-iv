import {
  orchestrateTask,
  type TaskAuthorizationDecision,
  type TaskCheckpointStore,
  type TaskExecutionScope,
} from "./task-orchestration";
import type { ExecutionOutcome } from "./execution-contract";

export type JsonSchema = Record<string, unknown>;

/** Public, model-readable metadata. Never contains executable server code. */
export interface ToolPromptDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/**
 * The parser is the trust boundary for model-produced arguments.
 * Implementations must validate shape, types, limits, and allowed values.
 */
export interface ServerToolDefinition<TArgs, TResult> extends ToolPromptDefinition {
  parseArguments(value: unknown): TArgs | null;
  execute(args: TArgs, scope: TaskExecutionScope): Promise<TResult>;
  verify(args: TArgs, result: TResult, scope: TaskExecutionScope): Promise<boolean>;
}

export interface ToolAuthorizationPolicy {
  authorize(input: TaskExecutionScope & {
    taskId: string;
    toolName: string;
    arguments: unknown;
  }): Promise<TaskAuthorizationDecision>;
}

export interface PlannedToolCall {
  /** Untrusted model output: this name must resolve to a server-registered tool. */
  toolName: string;
  arguments: unknown;
}

export interface ToolInvocationContext {
  /** Derived from the authenticated server session, never request JSON. */
  scope: TaskExecutionScope;
  authorization: ToolAuthorizationPolicy;
  checkpoints: TaskCheckpointStore;
  /** Generated and persisted by the server for this assistant turn/tool call. */
  invocationId: string;
}

export class ToolRegistry {
  private readonly definitions = new Map<string, ServerToolDefinition<unknown, unknown>>();

  register<TArgs, TResult>(definition: ServerToolDefinition<TArgs, TResult>): void {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(definition.name)) {
      throw new Error("Tool names must use 2-64 lowercase letters, digits, or underscores.");
    }
    if (!definition.description.trim()) {
      throw new Error("A tool description is required.");
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`Tool "${definition.name}" is already registered.`);
    }

    this.definitions.set(
      definition.name,
      definition as ServerToolDefinition<unknown, unknown>,
    );
  }

  /** Only safe metadata is exposed to a future model planner. */
  listForPlanner(): ToolPromptDefinition[] {
    return [...this.definitions.values()].map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  async invoke(
    call: PlannedToolCall,
    context: ToolInvocationContext,
  ): Promise<ExecutionOutcome<unknown>> {
    const definition = this.definitions.get(call.toolName);
    if (!definition) {
      return { status: "BLOCKED", reason: "The requested tool is not available." };
    }

    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(context.invocationId)) {
      return { status: "BLOCKED", reason: "A valid server invocation ID is required." };
    }
    if (!context.scope.principalId || !context.scope.conversationId) {
      return { status: "BLOCKED", reason: "Authenticated conversation scope is unavailable." };
    }

    let args: unknown;
    try {
      args = definition.parseArguments(call.arguments);
    } catch {
      return { status: "BLOCKED", reason: "Tool arguments failed validation." };
    }
    if (args === null) {
      return { status: "BLOCKED", reason: "Tool arguments are invalid." };
    }

    const taskId = `tool:${definition.name}:${context.invocationId}`;
    return orchestrateTask({
      taskId,
      scope: context.scope,
      authorization: {
        authorize: (scopeAndTask) => context.authorization.authorize({
          ...scopeAndTask,
          toolName: definition.name,
          arguments: args,
        }),
      },
      checkpoints: context.checkpoints,
      execute: () => definition.execute(args, context.scope),
      verify: (result) => definition.verify(args, result, context.scope),
    });
  }
}


/** Shared server-only registry. Register concrete tools during trusted server bootstrap. */
export const serverToolRegistry = new ToolRegistry();
