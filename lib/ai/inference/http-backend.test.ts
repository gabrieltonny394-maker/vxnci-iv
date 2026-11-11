import { describe, expect, it, vi, afterEach } from "vitest";
import { HttpInferenceBackend } from "./http-backend";

describe("HttpInferenceBackend", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports ready only when the health model ID matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ status: "ready", model_id: "vxnci-1-tiny" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
    const backend = new HttpInferenceBackend({
      modelId: "vxnci-1-tiny",
      baseUrl: "http://127.0.0.1:8091/",
      token: "test-token",
    });
    await expect(backend.isReady()).resolves.toBe(true);
  });

  it("rejects health from a different model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ status: "ready", model_id: "other-model" }),
      { status: 200 },
    )));
    const backend = new HttpInferenceBackend({
      modelId: "vxnci-1-tiny",
      baseUrl: "http://127.0.0.1:8091",
      token: "test-token",
    });
    await expect(backend.isReady()).resolves.toBe(false);
  });

  it("sends authenticated generation requests and validates returned identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        model: "vxnci-1-tiny",
        text: "response",
        finish_reason: "stop",
        usage: { input_tokens: 3, output_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const backend = new HttpInferenceBackend({
      modelId: "vxnci-1-tiny",
      baseUrl: "http://127.0.0.1:8091",
      token: "secret",
    });
    const result = await backend.generate({
      messages: [{ role: "user", content: "Hello" }],
      maxOutputTokens: 8,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8091/v1/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
    expect(result).toEqual({
      text: "response",
      finishReason: "stop",
      usage: { inputTokens: 3, outputTokens: 1 },
    });
  });
});
