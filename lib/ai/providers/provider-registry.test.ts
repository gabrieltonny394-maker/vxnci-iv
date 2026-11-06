import { describe, expect, it } from "vitest";
import type { ModelAdapter, ModelRequest, ModelResponse } from "../contracts";
import {
  ProviderRegistrationError,
  ProviderRegistry,
} from "./provider-registry";
import {
  InvalidChatRequestError,
  validateChatMessages,
} from "../safety";

function adapter(providerId: string, modelId: string): ModelAdapter {
  return {
    providerId,
    modelId,
    async generate(_request: ModelRequest): Promise<ModelResponse> {
      return { text: "test response", modelId };
    },
  };
}

describe("ProviderRegistry", () => {
  it("starts empty and reports no providers", () => {
    const registry = new ProviderRegistry();
    expect(registry.hasProviders()).toBe(false);
    expect(registry.listProviders()).toEqual([]);
    expect(registry.resolveModel("vxnci-test")).toBeUndefined();
  });

  it("registers and resolves a provider by id and model id", () => {
    const registry = new ProviderRegistry();
    const testAdapter = adapter("vxnci-local", "vxnci-test-1");
    registry.register({
      id: "vxnci-local",
      name: "VXNCI Local Runtime",
      kind: "local",
      adapter: testAdapter,
    });

    expect(registry.hasProviders()).toBe(true);
    expect(registry.resolveProvider("vxnci-local")?.adapter).toBe(testAdapter);
    expect(registry.resolveModel("vxnci-test-1")).toBe(testAdapter);
  });

  it("rejects empty provider identity", () => {
    const registry = new ProviderRegistry();
    expect(() =>
      registry.register({
        id: " ",
        name: "Provider",
        kind: "test",
        adapter: adapter(" ", "test-model"),
      })
    ).toThrow(ProviderRegistrationError);
  });

  it("rejects an adapter whose provider id does not match", () => {
    const registry = new ProviderRegistry();
    expect(() =>
      registry.register({
        id: "provider-a",
        name: "Provider A",
        kind: "test",
        adapter: adapter("provider-b", "model-a"),
      })
    ).toThrow(/providerId must match/);
  });

  it("rejects duplicate provider ids", () => {
    const registry = new ProviderRegistry();
    registry.register({
      id: "provider-a",
      name: "Provider A",
      kind: "test",
      adapter: adapter("provider-a", "model-a"),
    });

    expect(() =>
      registry.register({
        id: "provider-a",
        name: "Provider A again",
        kind: "test",
        adapter: adapter("provider-a", "model-b"),
      })
    ).toThrow(/already registered/);
  });

  it("rejects duplicate model ids across providers", () => {
    const registry = new ProviderRegistry();
    registry.register({
      id: "provider-a",
      name: "Provider A",
      kind: "test",
      adapter: adapter("provider-a", "shared-model"),
    });

    expect(() =>
      registry.register({
        id: "provider-b",
        name: "Provider B",
        kind: "test",
        adapter: adapter("provider-b", "shared-model"),
      })
    ).toThrow(/already registered/);
  });

  it("lists safe provider summaries without exposing adapters", () => {
    const registry = new ProviderRegistry();
    registry.register({
      id: "provider-a",
      name: "Provider A",
      kind: "self-hosted",
      adapter: adapter("provider-a", "model-a"),
    });

    expect(registry.listProviders()).toEqual([
      {
        id: "provider-a",
        name: "Provider A",
        kind: "self-hosted",
        modelId: "model-a",
      },
    ]);
  });

  it("clears registrations", () => {
    const registry = new ProviderRegistry();
    registry.register({
      id: "provider-a",
      name: "Provider A",
      kind: "test",
      adapter: adapter("provider-a", "model-a"),
    });
    registry.clear();
    expect(registry.hasProviders()).toBe(false);
  });
});

describe("validateChatMessages", () => {
  it("accepts a valid user message and trims its content", () => {
    expect(validateChatMessages([{ role: "user", content: "  Hello  " }])).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });

  it("rejects an empty conversation", () => {
    expect(() => validateChatMessages([])).toThrow(InvalidChatRequestError);
  });

  it("rejects unsupported roles", () => {
    expect(() =>
      validateChatMessages([{ role: "system", content: "Not allowed" }])
    ).toThrow(/role is not supported/);
  });

  it("requires the final message to be from the user", () => {
    expect(() =>
      validateChatMessages([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ])
    ).toThrow(/latest message must be from the user/);
  });

  it("rejects messages that exceed the per-message limit", () => {
    expect(() =>
      validateChatMessages([{ role: "user", content: "x".repeat(12_001) }])
    ).toThrow(/message is too long/);
  });

  it("rejects conversations that exceed the message count limit", () => {
    const messages = Array.from({ length: 31 }, () => ({
      role: "user",
      content: "x",
    }));
    expect(() => validateChatMessages(messages)).toThrow(/between 1 and 30/);
  });
});
