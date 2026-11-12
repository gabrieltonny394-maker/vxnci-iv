import { describe, expect, it } from "vitest";
import { createSecurePreviewDocument } from "./secure-document";

describe("secure live preview document", () => {
  it("injects policy and diagnostics before user scripts", () => {
    const result = createSecurePreviewDocument("<!doctype html><html><head><title>Demo</title><script>window.demo = true;</script></head><body>Hi</body></html>");
    const policyIndex = result.indexOf('http-equiv="Content-Security-Policy"');
    const diagnosticIndex = result.indexOf("luxora-preview-error");
    const userScriptIndex = result.indexOf("window.demo = true");
    expect(policyIndex).toBeGreaterThan(-1);
    expect(diagnosticIndex).toBeGreaterThan(policyIndex);
    expect(userScriptIndex).toBeGreaterThan(diagnosticIndex);
    expect(result).toContain("connect-src 'none'");
    expect(result).toContain("form-action 'none'");
    expect(result).toContain("<title>Demo</title>");
  });

  it("allows approved CDN assets but blocks arbitrary network connections", () => {
    const result = createSecurePreviewDocument("<html><head></head><body></body></html>");
    expect(result).toContain("https://cdn.tailwindcss.com");
    expect(result).toContain("https://fonts.googleapis.com");
    expect(result).toContain("connect-src 'none'");
    expect(result).not.toContain("unsafe-eval");
  });

  it("preserves inline scripts for client-side interactions", () => {
    const result = createSecurePreviewDocument("<html><head></head><body><script>window.demo = true;</script></body></html>");
    expect(result).toContain("<script>window.demo = true;</script>");
    expect(result).toContain("script-src 'unsafe-inline'");
  });

  it("wraps an HTML fragment in a document", () => {
    const result = createSecurePreviewDocument("<h1>Hello preview</h1>");
    expect(result).toContain("<html><head>");
    expect(result).toContain("<h1>Hello preview</h1>");
  });

  it("does not grant same-origin privileges", () => {
    const result = createSecurePreviewDocument("<p>safe</p>");
    expect(result).not.toContain("allow-same-origin");
  });
});
