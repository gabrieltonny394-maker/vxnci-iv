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
    super("No VXNCI model runtime is configured.");
    this.name = "ModelNotConfiguredError";
  }
}
