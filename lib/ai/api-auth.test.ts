import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { isValidApiKey } from "./api-auth";

const originalHash = process.env.VXNCI_API_KEY_SHA256;
const testKey = "vxnci-test-key-do-not-use-in-production";
const testHash = createHash("sha256").update(testKey, "utf8").digest("hex");

afterEach(() => {
  if (originalHash === undefined) delete process.env.VXNCI_API_KEY_SHA256;
  else process.env.VXNCI_API_KEY_SHA256 = originalHash;
});

function request(authorization?: string) {
  return new NextRequest("http://localhost/api/v1/models", {
    headers: authorization ? { authorization } : {},
  });
}

describe("VXNCI API authentication", () => {
  it("accepts a bearer key matching the configured hash", () => {
    process.env.VXNCI_API_KEY_SHA256 = testHash;
    expect(isValidApiKey(request(`Bearer ${testKey}`))).toBe(true);
  });

  it("rejects a missing bearer key", () => {
    process.env.VXNCI_API_KEY_SHA256 = testHash;
    expect(isValidApiKey(request())).toBe(false);
  });

  it("rejects an incorrect bearer key", () => {
    process.env.VXNCI_API_KEY_SHA256 = testHash;
    expect(isValidApiKey(request("Bearer incorrect-key"))).toBe(false);
  });

  it("rejects an absent or malformed server-side hash", () => {
    delete process.env.VXNCI_API_KEY_SHA256;
    expect(isValidApiKey(request(`Bearer ${testKey}`))).toBe(false);
    process.env.VXNCI_API_KEY_SHA256 = "not-a-sha256-hash";
    expect(isValidApiKey(request(`Bearer ${testKey}`))).toBe(false);
  });
});
