import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelAdapter, ModelRequest, ModelResponse } from "./contracts";
import { runChat } from "./orchestration";
import { providerRegistry } from "./providers/provider-registry";
import { serverToolRegistry } from "./tool-registry";
import type { ToolInvocationContext } from "./tool-registry";

const originalModel = process.env.VXNCI_DEFAULT_MODEL;

afterEach(() => {
  providerRegistry.clear();
  serverToolRegistry.clear();
  if (originalModel === undefined) delete process.env.VXNCI_DEFAULT_MODEL;
  else process.env.VXNCI_DEFAULT_MODEL = originalModel;
});

function makeContext(): ToolInvocationContext {
  return {
    scope: { principalId: "verified-user", conversationId: "conversation-1" },
    authorization: { authorize: async () => ({ allowed: true }) },
    checkpoints: { load: async () => null, save: async () => undefined },
    invocationId: "server-call-0001",
  };
}

function registerAdapter(adapter: ModelAdapter) {
  providerRegistry.register({
    id: adapter.providerId,
    name: "Test runtime",
    kind: "test",
    adapter,
  });
  process.env.VXNCI_DEFAULT_MODEL = adapter.modelId;
}

describe("live chat tool-planning integration", () => {
  it("uses ordinary generation when no trusted tool runtime is available", async () => {
    const generate = vi.fn(async (_request: ModelRequest): Promise<ModelResponse> => ({
      text: "Normal answer",
      modelId: "test-model",
    }));
    const plan = vi.fn();
    const adapter = { providerId: "test-provider", modelId: "test-model", generate, plan };
    registerAdapter(adapter);

    const response = await runChat([{ role: "user", content: "Hello" }]);

    expect(response.text).toBe("Normal answer");
    expect(plan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledOnce();
  });

  it("executes a registered server tool and sends its verified outcome back to the model", async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const verify = vi.fn(async () => true);
    serverToolRegistry.register<{ value: string }, { saved: boolean }>({
      name: "save_note",
      description: "Save a note.",
      inputSchema: { type: "object" },
      parseArguments(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        const candidate = value as Record<string, unknown>;
        return typeof candidate.value === "string" ? { value: candidate.value } : null;
      },
      execute,
      verify,
    });

    const generate = vi.fn(async (request: ModelRequest): Promise<ModelResponse> => ({
      text: request.messages.at(-1)?.content.includes('"status":"COMPLETED')
        ? "Your note was saved."
        : "Unexpected tool context",
      modelId: "tool-model",
    }));
    const plan = vi.fn(async () => ({
      type: "tool_call",
      toolName: "save_note",
      arguments: { value: "Keep this" },
    }));
    const adapter = { providerId: "tool-provider", modelId: "tool-model", generate, plan };
    registerAdapter(adapter);

    const response = await runChat(
      [{ role: "user", content: "Save this note" }],
      undefined,
      makeContext(),
    );

    expect(plan).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      { value: "Keep this" },
      { principalId: "verified-user", conversationId: "conversation-1" },
    );
    expect(verify).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0].messages.at(-1)?.role).toBe("system");
    expect(response.text).toBe("Your note was saved.");
  });

  it("does not execute tools when planner output is invalid", async () => {
    const execute = vi.fn();
    serverToolRegistry.register<{ value: string }, void>({
      name: "safe_tool",
      description: "A safe tool.",
      inputSchema: { type: "object" },
      parseArguments: () => ({ value: "ok" }),
      execute,
      verify: async () => true,
    });
    const generate = vi.fn(async (): Promise<ModelResponse> => ({
      text: "Fallback answer",
      modelId: "invalid-plan-model",
    }));
    const adapter = {
      providerId: "invalid-plan-provider",
      modelId: "invalid-plan-model",
      generate,
      plan: async () => ({ type: "tool_call", toolName: "", arguments: {} }),
    };
    registerAdapter(adapter);

    const response = await runChat(
      [{ role: "user", content: "Do something" }],
      undefined,
      makeContext(),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(response.text).toBe("Fallback answer");
  });
  it("uses the explicitly requested model instead of the configured default", async () => {
    const defaultGenerate = vi.fn(async (): Promise<ModelResponse> => ({
      text: "Default model response",
      modelId: "default-model",
    }));
    const requestedGenerate = vi.fn(async (request: ModelRequest): Promise<ModelResponse> => ({
      text: "Requested model response",
      modelId: request.modelId,
    }));

    const defaultAdapter = { providerId: "default-provider", modelId: "default-model", generate: defaultGenerate };
    const requestedAdapter = { providerId: "requested-provider", modelId: "requested-model", generate: requestedGenerate };

    providerRegistry.register({ id: defaultAdapter.providerId, name: "Default runtime", kind: "test", adapter: defaultAdapter });
    providerRegistry.register({ id: requestedAdapter.providerId, name: "Requested runtime", kind: "test", adapter: requestedAdapter });
    process.env.VXNCI_DEFAULT_MODEL = "default-model";

    const response = await runChat(
      [{ role: "user", content: "Use the requested model" }],
      undefined,
      undefined,
      "requested-model",
    );

    expect(defaultGenerate).not.toHaveBeenCalled();
    expect(requestedGenerate).toHaveBeenCalledOnce();
    expect(requestedGenerate.mock.calls[0][0].modelId).toBe("requested-model");
    expect(response.modelId).toBe("requested-model");
  });

  it("rejects an unknown explicitly requested model instead of silently using the default", async () => {
    const generate = vi.fn(async (): Promise<ModelResponse> => ({
      text: "Should not run",
      modelId: "default-model",
    }));
    const adapter = { providerId: "default-provider", modelId: "default-model", generate };
    providerRegistry.register({ id: adapter.providerId, name: "Default runtime", kind: "test", adapter });
    process.env.VXNCI_DEFAULT_MODEL = "default-model";

    await expect(
      runChat(
        [{ role: "user", content: "Use a missing model" }],
        undefined,
        undefined,
        "missing-model",
      ),
    ).rejects.toMatchObject({ name: "ModelNotFoundError", modelId: "missing-model" });

    expect(generate).not.toHaveBeenCalled();
  });

});
