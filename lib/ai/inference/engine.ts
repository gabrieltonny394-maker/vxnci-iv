import type { ModelAdapter, ModelRequest, ModelResponse } from "../contracts";
import {
  InferenceConfigurationError,
  InferenceRuntimeUnavailableError,
  type InferenceBackend,
  type ModelArtifactManifest,
} from "./types";

export function validateModelManifest(value: ModelArtifactManifest): void {
  if (value.formatVersion !== 1) {
    throw new InferenceConfigurationError("Unsupported model manifest format version.");
  }
  if (!value.modelId.trim() || !value.architecture.trim() || !value.tokenizer.trim()) {
    throw new InferenceConfigurationError("Model identity, architecture, and tokenizer are required.");
  }
  if (!value.weightsPath.trim() || value.weightsPath.startsWith("/") || value.weightsPath.includes("..")) {
    throw new InferenceConfigurationError("Model weights path must be a safe relative path.");
  }
  if (!Number.isInteger(value.contextLength) || value.contextLength < 1) {
    throw new InferenceConfigurationError("Model contextLength must be a positive integer.");
  }
  if (!Number.isInteger(value.maxOutputTokens) || value.maxOutputTokens < 1 || value.maxOutputTokens > value.contextLength) {
    throw new InferenceConfigurationError("Model maxOutputTokens must be within the model context length.");
  }
}

/**
 * Model-independent inference orchestration. A concrete backend must provide
 * tokenization, model execution, and decoding; this engine never fabricates output.
 */
export class VxnciInferenceEngine {
  readonly modelId: string;

  constructor(
    readonly manifest: ModelArtifactManifest,
    private readonly backend?: InferenceBackend,
  ) {
    validateModelManifest(manifest);
    this.modelId = manifest.modelId;

    if (backend && backend.modelId !== manifest.modelId) {
      throw new InferenceConfigurationError("Inference backend modelId does not match the manifest.");
    }
  }

  get ready(): boolean {
    return Boolean(this.backend);
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    if (!this.backend) throw new InferenceRuntimeUnavailableError();
    if (request.modelId !== this.modelId) {
      throw new InferenceConfigurationError("Requested model does not match this inference engine.");
    }
    if (request.signal?.aborted) {
      throw new DOMException("The inference request was aborted.", "AbortError");
    }

    const maxOutputTokens = Math.min(
      request.maxOutputTokens ?? 1_024,
      this.manifest.maxOutputTokens,
    );
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
      throw new InferenceConfigurationError("maxOutputTokens must be a positive integer.");
    }

    const output = await this.backend.generate({
      messages: request.messages,
      maxOutputTokens,
      signal: request.signal,
    });

    if (typeof output.text !== "string" || !output.text.trim()) {
      throw new Error("Inference backend returned an empty response.");
    }

    return {
      text: output.text,
      modelId: this.modelId,
      finishReason: output.finishReason,
      usage: output.usage,
    };
  }
}

export function createInferenceAdapter(engine: VxnciInferenceEngine): ModelAdapter {
  return {
    providerId: "vxnci-intelligence",
    modelId: engine.modelId,
    generate: (request) => engine.generate(request),
  };
}
