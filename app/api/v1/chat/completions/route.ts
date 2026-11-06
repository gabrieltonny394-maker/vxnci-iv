import { NextRequest, NextResponse } from "next/server";
import { isValidApiKey } from "@/lib/ai/api-auth";
import { ModelNotConfiguredError } from "@/lib/ai/contracts";
import { runChat } from "@/lib/ai/orchestration";
import { InvalidChatRequestError } from "@/lib/ai/safety";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isValidApiKey(request)) {
    return NextResponse.json({ error: { type: "authentication_error", message: "A valid bearer API key is required." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { type: "invalid_request_error", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: { type: "invalid_request_error", message: "Request body must be a JSON object." } }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (payload.stream === true) {
    return NextResponse.json({ error: { type: "invalid_request_error", message: "Streaming is not supported yet." } }, { status: 400 });
  }

  try {
    const result = await runChat(payload.messages, request.signal);
    return NextResponse.json({
      id: `vxnci-chat-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.modelId,
      choices: [{
        index: 0,
        message: { role: "assistant", content: result.text },
        finish_reason: result.finishReason ?? "stop",
      }],
      ...(result.usage ? { usage: {
        prompt_tokens: result.usage.inputTokens,
        completion_tokens: result.usage.outputTokens,
        total_tokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      } } : {}),
    });
  } catch (error) {
    if (error instanceof InvalidChatRequestError) {
      return NextResponse.json({ error: { type: "invalid_request_error", message: error.message } }, { status: 400 });
    }

    if (error instanceof ModelNotConfiguredError || (error instanceof Error && error.message === "VXNCI_MODEL_NOT_CONFIGURED")) {
      return NextResponse.json({ error: { type: "server_error", message: "No VXNCI model runtime is configured." } }, { status: 503 });
    }

    console.error("VXNCI API request failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: { type: "server_error", message: "The AI request could not be completed." } }, { status: 500 });
  }
}
