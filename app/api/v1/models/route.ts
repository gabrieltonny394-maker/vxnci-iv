import { NextRequest, NextResponse } from "next/server";
import { isValidApiKey } from "../../../../lib/ai/api-auth";
import { modelRouter } from "../../../../lib/ai/model-router";
import { ensureConfiguredInferenceModelRegistered } from "../../../../lib/ai/inference/runtime-bootstrap";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isValidApiKey(request)) {
    return NextResponse.json(
      {
        error: {
          type: "authentication_error",
          message: "A valid bearer API key is required.",
        },
      },
      { status: 401 }
    );
  }

  await ensureConfiguredInferenceModelRegistered();
  // Only a model with a matching, healthy inference service can enter this list.
  const models = modelRouter.listProviders().map((provider) => ({
    id: provider.modelId,
    object: "model",
    owned_by: provider.id,
    provider_name: provider.name,
    provider_kind: provider.kind,
    status: "ready",
  }));

  return NextResponse.json({ object: "list", data: models });
}
