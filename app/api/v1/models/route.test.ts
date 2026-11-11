import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../../../lib/ai/api-auth", () => ({
  isValidApiKey: vi.fn(() => true),
}));

import { isValidApiKey } from "../../../../lib/ai/api-auth";
import { GET } from "./route";
import { providerRegistry } from "../../../../lib/ai/providers/provider-registry";
import type { ModelAdapter } from "../../../../lib/ai/contracts";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/v1/models", {
    headers: { authorization: "Bearer test-key" },
  });
}

function adapter(providerId: string, modelId: string): ModelAdapter {
  return {
    providerId,
    modelId,
    async generate() {
      return { text: "test", modelId };
    },
  };
}

describe("GET /api/v1/models", () => {
  beforeEach(() => {
    providerRegistry.clear();
    vi.mocked(isValidApiKey).mockReturnValue(true);
  });

  it("returns an empty catalogue when no model adapters are registered", async () => {
    const response = GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [],
    });
  });

  it("advertises only registered ready adapters", async () => {
    providerRegistry.register({
      id: "luxora-local",
      name: "LUXORA Local",
      kind: "local",
      adapter: adapter("luxora-local", "luxora-core-experimental"),
    });

    const response = GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "luxora-core-experimental",
          object: "model",
          owned_by: "luxora-local",
          provider_name: "LUXORA Local",
          provider_kind: "local",
          status: "ready",
        },
      ],
    });
  });

  it("does not advertise planned tiers without registered adapters", async () => {
    providerRegistry.register({
      id: "experimental-provider",
      name: "Experimental Provider",
      kind: "test",
      adapter: adapter("experimental-provider", "vxnci-1-tiny"),
    });

    const response = GET(request());
    const body = await response.json();

    expect(body.data.map((model: { id: string }) => model.id)).toEqual([
      "vxnci-1-tiny",
    ]);
    expect(body.data.some((model: { id: string }) =>
      ["luxora-core", "luxora-nova", "luxora-titan", "luxora-apex"].includes(model.id)
    )).toBe(false);
  });

  it("requires a valid API key", () => {
    vi.mocked(isValidApiKey).mockReturnValue(false);

    const response = GET(request());

    expect(response.status).toBe(401);
  });
});
