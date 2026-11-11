import type { ChatMessage, ModelAdapter } from "./contracts";
import type { ExecutionOutcome } from "./execution-contract";
import {
  ToolRegistry,
  type ToolInvocationContext,
  type ToolPromptDefinition,
} from "./tool-registry";

export type AssistantPlan =
  | { type: "message"; content: string }
  | { type: "tool_call"; toolName: string; arguments: unknown };

/**
 * A model adapter may implement this contract once it supports structured
 * tool calls. The planner is not trusted to authorize actions or supply
 * identity, approval, invocation IDs, or checkpoint storage.
 */
export interface ToolPlanner {
  plan(input: {
    messages: ChatMessage[];
    tools: ToolPromptDefinition[];
    signal?: AbortSignal;
  }): Promise<unknown>;
}

export type PlannedTurnOutcome =
  | { type: "message"; content: string }
  | { type: "tool_result"; outcome: ExecutionOutcome<unknown> }
  | { type: "invalid_plan"; reason: string };

function parseAssistantPlan(value: unknown): AssistantPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.type === "message") {
    if (typeof candidate.content !== "string" || !candidate.content.trim()) return null;
    return { type: "message", content: candidate.content };
  }

  if (candidate.type === "tool_call") {
    if (typeof candidate.toolName !== "string" || !candidate.toolName.trim()) return null;
    return {
      type: "tool_call",
      toolName: candidate.toolName,
      arguments: candidate.arguments,
    };
  }

  return null;
}

/**
 * Executes at most one planned tool call per turn. The caller supplies only
 * trusted server context; model output is parsed and routed through the
 * server-owned registry. Multi-step agent loops are intentionally not enabled.
 */
export async function runPlannedTurn(input: {
  planner: ToolPlanner;
  registry: ToolRegistry;
  messages: ChatMessage[];
  context: ToolInvocationContext;
  signal?: AbortSignal;
}): Promise<PlannedTurnOutcome> {
  let rawPlan: unknown;
  try {
    rawPlan = await input.planner.plan({
      messages: input.messages,
      tools: input.registry.listForPlanner(),
      signal: input.signal,
    });
  } catch {
    return { type: "invalid_plan", reason: "The assistant could not produce a usable plan." };
  }

  const plan = parseAssistantPlan(rawPlan);
  if (!plan) {
    return { type: "invalid_plan", reason: "The assistant returned an invalid plan." };
  }

  if (plan.type === "message") {
    return { type: "message", content: plan.content };
  }

  const outcome = await input.registry.invoke({
    toolName: plan.toolName,
    arguments: plan.arguments,
  }, input.context);

  return { type: "tool_result", outcome };
}


/** A model provider may opt into structured tool planning by implementing this interface. */
export interface ToolPlanningModelAdapter extends ModelAdapter, ToolPlanner {}
