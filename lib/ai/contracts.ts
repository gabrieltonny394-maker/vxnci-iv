export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelRequest {
  messages: ChatMessage[];
  modelId: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ModelResponse {
  text: string;
  modelId: string;
  finishReason?: "stop" | "length" | "unknown";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ModelAdapter {
  readonly providerId: string;
  readonly modelId: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export class ModelNotConfiguredError extends Error {
  constructor() {
    super("No LUXORA AI model runtime is configured.");
    this.name = "ModelNotConfiguredError";
  }
}

export class ModelNotFoundError extends Error {
  constructor(readonly modelId: string) {
    super(`The requested model "${modelId}" is not available.`);
    this.name = "ModelNotFoundError";
  }
}
