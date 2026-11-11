import type { ModelResponse } from "./contracts";
import { modelRouter } from "./model-router";
import { validateChatMessages } from "./safety";

// Task execution is exposed through the same AI orchestration boundary.
// Runtime callers must provide server-derived identity, policy, and checkpoint adapters.
export { orchestrateTask } from "./task-orchestration";
export type {
  OrchestratedTask,
  TaskAuthorizationDecision,
  TaskAuthorizationPolicy,
  TaskCheckpointStore,
  TaskExecutionScope,
} from "./task-orchestration";

export async function runChat(input: unknown, signal?: AbortSignal): Promise<ModelResponse> {
  const messages = validateChatMessages(input);
  const modelId = process.env.VXNCI_DEFAULT_MODEL;

  if (!modelId) {
    throw new Error("VXNCI_MODEL_NOT_CONFIGURED");
  }

  const adapter = modelRouter.resolve(modelId);
  return adapter.generate({
    messages,
    modelId,
    maxOutputTokens: 1_024,
    signal
  });
}
