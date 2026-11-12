const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
  "img-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "media-src data: blob:",
  "manifest-src 'none'"
].join("; ");

const DIAGNOSTICS_SCRIPT = `<script>
(function () {
  function report(message) {
    try { parent.postMessage({ type: "luxora-preview-error", message: String(message).slice(0, 500) }, "*"); }
    catch (_) {}
  }
  window.addEventListener("error", function (event) { report(event.message || "Script execution error"); });
  window.addEventListener("unhandledrejection", function (event) {
    report(event.reason && event.reason.message ? event.reason.message : event.reason || "Unhandled promise rejection");
  });
})();
</script>`;

/**
 * Adds a restrictive policy and lightweight runtime diagnostics before user
 * scripts. The parent must use sandbox="allow-scripts" without allow-same-origin.
 */
export function createSecurePreviewDocument(source: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  const headTag = /<head(?:\s[^>]*)?>/i;
  const htmlTag = /<html(?:\s[^>]*)?>/i;

  if (headTag.test(source)) {
    return source.replace(headTag, head => `${head}\n${policy}${DIAGNOSTICS_SCRIPT}`);
  }
  if (htmlTag.test(source)) {
    return source.replace(htmlTag, html => `${html}\n<head><meta charset="utf-8">${policy}${DIAGNOSTICS_SCRIPT}</head>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8">${policy}${DIAGNOSTICS_SCRIPT}</head><body>${source}</body></html>`;
}
