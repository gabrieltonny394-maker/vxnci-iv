import { NextRequest, NextResponse } from "next/server";
import { isValidApiKey } from "@/lib/ai/api-auth";
import { modelRouter } from "@/lib/ai/model-router";

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

  // The registry is the source of truth. Do not advertise planned tiers or
  // model IDs that do not have a deliberately registered adapter.
  const models = modelRouter.listProviders().map((provider) => ({
    id: provider.modelId,
    object: "model",
    owned_by: provider.id,
    provider_name: provider.name,
    provider_kind: provider.kind,
    status: "registered",
  }));

  return NextResponse.json({ object: "list", data: models });
}
