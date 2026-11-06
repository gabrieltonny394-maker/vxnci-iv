import { describe, expect, it, vi } from "vitest";
import { createInferenceAdapter, validateModelManifest, VxnciInferenceEngine } from "./engine";
import { InferenceConfigurationError, InferenceRuntimeUnavailableError, type InferenceBackend, type ModelArtifactManifest } from "./types";

const manifest: ModelArtifactManifest = {
  formatVersion: 1,
  modelId: "vxnci-1",
  architecture: "decoder-transformer",
  tokenizer: "vxnci-tokenizer-v1",
  weightsPath: "models/vxnci-1/weights.bin",
  contextLength: 2_048,
  maxOutputTokens: 512,
};

describe("VXNCI inference engine", () => {
  it("validates a model manifest", () => {
    expect(() => validateModelManifest(manifest)).not.toThrow();
  });

  it("rejects unsafe weights paths", () => {
    expect(() => validateModelManifest({ ...manifest, weightsPath: "../private.bin" })).toThrow(InferenceConfigurationError);
    expect(() => validateModelManifest({ ...manifest, weightsPath: "/private.bin" })).toThrow(InferenceConfigurationError);
  });

  it("rejects invalid token limits", () => {
    expect(() => validateModelManifest({ ...manifest, contextLength: 0 })).toThrow(InferenceConfigurationError);
    expect(() => validateModelManifest({ ...manifest, maxOutputTokens: 3_000 })).toThrow(InferenceConfigurationError);
  });

  it("reports not ready when no backend is attached and never fabricates a response", async () => {
    const engine = new VxnciInferenceEngine(manifest);
    expect(engine.ready).toBe(false);
    await expect(engine.generate({ modelId: manifest.modelId, messages: [{ role: "user", content: "Hi" }] })).rejects.toThrow(InferenceRuntimeUnavailableError);
  });

  it("rejects a backend for a different model", () => {
    const backend: InferenceBackend = { modelId: "other-model", generate: vi.fn() };
    expect(() => new VxnciInferenceEngine(manifest, backend)).toThrow(InferenceConfigurationError);
  });

  it("passes requests to the backend and returns its output", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: "Backend response",
      finishReason: "stop",
      usage: { inputTokens: 3, outputTokens: 2 },
    });
    const backend: InferenceBackend = { modelId: manifest.modelId, generate };
    const engine = new VxnciInferenceEngine(manifest, backend);
    const result = await engine.generate({
      modelId: manifest.modelId,
      messages: [{ role: "user", content: "Hello" }],
      maxOutputTokens: 1_000,
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 512 }));
    expect(result).toEqual({
      text: "Backend response",
      modelId: manifest.modelId,
      finishReason: "stop",
      usage: { inputTokens: 3, outputTokens: 2 },
    });
  });

  it("exposes the engine through the provider adapter contract", () => {
    const backend: InferenceBackend = {
      modelId: manifest.modelId,
      generate: vi.fn().mockResolvedValue({ text: "ok", finishReason: "stop" }),
    };
    const adapter = createInferenceAdapter(new VxnciInferenceEngine(manifest, backend));
    expect(adapter.providerId).toBe("vxnci-intelligence");
    expect(adapter.modelId).toBe(manifest.modelId);
  });
});
