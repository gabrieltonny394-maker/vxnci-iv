import type { ChatMessage } from "../contracts";

export interface ModelArtifactManifest {
  formatVersion: 1;
  modelId: string;
  architecture: string;
  tokenizer: string;
  weightsPath: string;
  contextLength: number;
  maxOutputTokens: number;
}

export interface InferenceInput {
  messages: ChatMessage[];
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface InferenceOutput {
  text: string;
  finishReason: "stop" | "length" | "unknown";
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface InferenceBackend {
  readonly modelId: string;
  generate(input: InferenceInput): Promise<InferenceOutput>;
}

export class InferenceRuntimeUnavailableError extends Error {
  constructor(message = "No inference backend is attached to this model.") {
    super(message);
    this.name = "InferenceRuntimeUnavailableError";
  }
}

export class InferenceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InferenceConfigurationError";
  }
}
