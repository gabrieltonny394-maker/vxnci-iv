import { describe, expect, it } from "vitest";
import { createSecurePreviewDocument } from "./secure-document";

describe("secure live preview document", () => {
  it("injects a restrictive CSP into a complete HTML document", () => {
    const result = createSecurePreviewDocument("<!doctype html><html><head><title>Demo</title></head><body>Hi</body></html>");
    expect(result).toContain('http-equiv="Content-Security-Policy"');
    expect(result).toContain("connect-src 'none'");
    expect(result).toContain("<title>Demo</title>");
  });

  it("preserves inline scripts so sandboxed client-side interactions can run", () => {
    const result = createSecurePreviewDocument("<html><head></head><body><script>window.demo = true;</script></body></html>");
    expect(result).toContain("<script>window.demo = true;</script>");
    expect(result).toContain("script-src 'unsafe-inline'");
  });

  it("wraps an HTML fragment in a document", () => {
    const result = createSecurePreviewDocument("<h1>Hello preview</h1>");
    expect(result).toContain("<html><head>");
    expect(result).toContain("<h1>Hello preview</h1>");
  });
});
