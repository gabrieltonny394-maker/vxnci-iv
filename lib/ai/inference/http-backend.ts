import type { ChatMessage } from "../contracts";
import type { InferenceBackend, InferenceOutput } from "./types";

interface HttpInferenceBackendOptions {
  modelId: string;
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

/** HTTP bridge to the separately hosted local PyTorch inference service. */
export class HttpInferenceBackend implements InferenceBackend {
  readonly modelId: string;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: HttpInferenceBackendOptions) {
    if (!options.modelId.trim() || !options.token.trim()) {
      throw new Error("Inference model ID and service token are required.");
    }
    this.modelId = options.modelId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    const parsed = new URL(this.baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Inference service URL must use HTTP or HTTPS.");
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 3_000)),
        cache: "no-store",
      });
      if (!response.ok) return false;
      const body: unknown = await response.json();
      return Boolean(body && typeof body === "object" &&
        (body as Record<string, unknown>).status === "ready" &&
        (body as Record<string, unknown>).model_id === this.modelId);
    } catch {
      return false;
    }
  }

  async generate(input: { messages: ChatMessage[]; maxOutputTokens: number; signal?: AbortSignal }): Promise<InferenceOutput> {
    const response = await fetch(`${this.baseUrl}/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        messages: input.messages,
        max_output_tokens: input.maxOutputTokens,
      }),
      signal: input.signal ?? AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Inference service returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") {
      throw new Error("Inference service returned an invalid response.");
    }
    const value = body as Record<string, unknown>;
    if (value.model !== this.modelId || typeof value.text !== "string" || !value.text.trim()) {
      throw new Error("Inference service response did not match the configured model.");
    }
    const usage = value.usage && typeof value.usage === "object"
      ? value.usage as Record<string, unknown>
      : undefined;
    const finishReason = value.finish_reason;
    return {
      text: value.text,
      finishReason: finishReason === "length" || finishReason === "stop" ? finishReason : "unknown",
      ...(usage ? { usage: {
        ...(typeof usage.input_tokens === "number" ? { inputTokens: usage.input_tokens } : {}),
        ...(typeof usage.output_tokens === "number" ? { outputTokens: usage.output_tokens } : {}),
      } } : {}),
    };
  }
}
