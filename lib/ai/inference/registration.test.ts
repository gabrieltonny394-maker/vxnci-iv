import { describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "../providers/provider-registry";
import { registerInferenceModel } from "./engine";
import { InferenceRuntimeUnavailableError, type InferenceBackend, type ModelArtifactManifest } from "./types";

const manifest: ModelArtifactManifest = {
  formatVersion: 1,
  modelId: "luxora-core-experimental",
  architecture: "decoder-transformer",
  tokenizer: "byte-bpe-v1",
  weightsPath: "model/luxora-core/weights.safetensors",
  contextLength: 512,
  maxOutputTokens: 256,
};

describe("registerInferenceModel", () => {
  it("refuses to register a manifest when no inference backend is attached", () => {
    const registry = new ProviderRegistry();

    expect(() => registerInferenceModel({
      registry,
      providerId: "luxora-local",
      providerName: "LUXORA Local",
      providerKind: "local",
      manifest,
    })).toThrow(InferenceRuntimeUnavailableError);

    expect(registry.listProviders()).toEqual([]);
  });

  it("registers a model only after a matching backend is attached", async () => {
    const registry = new ProviderRegistry();
    const backend: InferenceBackend = {
      modelId: manifest.modelId,
      generate: vi.fn().mockResolvedValue({
        text: "Verified backend output",
        finishReason: "stop",
        usage: { inputTokens: 4, outputTokens: 3 },
      }),
    };

    const engine = registerInferenceModel({
      registry,
      providerId: "luxora-local",
      providerName: "LUXORA Local Runtime",
      providerKind: "local",
      manifest,
      backend,
    });

    expect(engine.ready).toBe(true);
    expect(registry.listProviders()).toEqual([{
      id: "luxora-local",
      name: "LUXORA Local Runtime",
      kind: "local",
      modelId: manifest.modelId,
    }]);

    const adapter = registry.resolveModel(manifest.modelId);
    expect(adapter).toBeDefined();
    await expect(adapter?.generate({
      modelId: manifest.modelId,
      messages: [{ role: "user", content: "Hello" }],
    })).resolves.toMatchObject({
      text: "Verified backend output",
      modelId: manifest.modelId,
    });
  });

  it("does not register a backend for a different model", () => {
    const registry = new ProviderRegistry();
    const backend: InferenceBackend = {
      modelId: "some-other-model",
      generate: vi.fn(),
    };

    expect(() => registerInferenceModel({
      registry,
      providerId: "luxora-local",
      providerName: "LUXORA Local",
      providerKind: "local",
      manifest,
      backend,
    })).toThrow(/does not match the manifest/);
    expect(registry.listProviders()).toEqual([]);
  });
});
