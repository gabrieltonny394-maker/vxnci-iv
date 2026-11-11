import { NextRequest, NextResponse } from "next/server";
import { ModelNotConfiguredError } from "@/lib/ai/contracts";
import { runChat } from "@/lib/ai/orchestration";
import { InvalidChatRequestError } from "@/lib/ai/safety";
import { resolveServerToolRuntime } from "@/lib/ai/tool-runtime";
import { ensureConfiguredInferenceModelRegistered } from "@/lib/ai/inference/runtime-bootstrap";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const messages = body && typeof body === "object"
    ? (body as Record<string, unknown>).messages
    : undefined;

  try {
    await ensureConfiguredInferenceModelRegistered();
    // Identity, authorization and checkpoint dependencies are resolved only by
    // trusted server code. No caller-supplied user ID or approval flag is read.
    const toolRuntime = await resolveServerToolRuntime(request);
    const result = await runChat(messages, request.signal, toolRuntime);
    return NextResponse.json({ message: result.text, model: result.modelId });
  } catch (error) {
    if (error instanceof InvalidChatRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ModelNotConfiguredError || (error instanceof Error && error.message === "VXNCI_MODEL_NOT_CONFIGURED")) {
      return NextResponse.json({ error: "LUXORA AI has no model runtime configured yet." }, { status: 503 });
    }
    console.error("LUXORA chat request failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "The AI request could not be completed." }, { status: 500 });
  }
}
