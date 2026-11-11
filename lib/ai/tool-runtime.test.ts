import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureServerToolRuntimeResolver,
  resetServerToolRuntimeResolverForTests,
  resolveServerToolRuntime,
} from "./tool-runtime";

afterEach(() => resetServerToolRuntimeResolverForTests());

const request = () => new NextRequest("http://localhost/api/chat");

describe("server tool runtime resolver", () => {
  it("disables tool execution until trusted server bootstrap configures a resolver", async () => {
    expect(await resolveServerToolRuntime(request())).toBeNull();
  });

  it("creates invocation IDs on the server, not from request input", async () => {
    configureServerToolRuntimeResolver(async () => ({
      scope: { principalId: "verified-user", conversationId: "chat-1" },
      authorization: { authorize: async () => ({ allowed: true }) },
      checkpoints: { load: async () => null, save: async () => undefined },
    }));

    const first = await resolveServerToolRuntime(request());
    const second = await resolveServerToolRuntime(request());

    expect(first?.scope.principalId).toBe("verified-user");
    expect(first?.invocationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second?.invocationId).not.toBe(first?.invocationId);
  });

  it("fails closed when identity or checkpoint dependencies cannot be resolved", async () => {
    configureServerToolRuntimeResolver(async () => {
      throw new Error("auth provider unavailable");
    });

    await expect(resolveServerToolRuntime(request())).resolves.toBeNull();
  });

  it("does not allow resolver replacement after trusted bootstrap", () => {
    const resolver = vi.fn().mockResolvedValue(null);
    configureServerToolRuntimeResolver(resolver);
    expect(() => configureServerToolRuntimeResolver(resolver)).toThrow(
      "A server tool runtime resolver is already configured.",
    );
  });
});
