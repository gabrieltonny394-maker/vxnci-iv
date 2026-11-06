import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * API keys are supplied by the operator and stored as SHA-256 hashes in
 * VXNCI_API_KEY_SHA256. Plaintext keys are never stored in source control.
 * This initial single-key gate is intended for controlled integration tests;
 * production key issuance, rotation, revocation and per-key limits are later work.
 */
export function isValidApiKey(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\\s]+)$/.exec(authorization);
  const configuredHash = process.env.VXNCI_API_KEY_SHA256 ?? "";

  if (!match || !/^[a-f0-9]{64}$/i.test(configuredHash)) return false;

  const suppliedHash = createHash("sha256").update(match[1], "utf8").digest();
  const expectedHash = Buffer.from(configuredHash, "hex");

  return suppliedHash.length === expectedHash.length &&
    timingSafeEqual(suppliedHash, expectedHash);
}
