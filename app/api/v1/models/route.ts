import { NextRequest, NextResponse } from "next/server";
import { isValidApiKey } from "../../../../lib/ai/api-auth";
import { modelRouter } from "../../../../lib/ai/model-router";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
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

  // Providers enter this registry through a ready adapter. Do not advertise
  // planned tiers, manifest-only models, or models without an inference backend.
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
