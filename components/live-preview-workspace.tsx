"use client";

import { useMemo, useState } from "react";
import { createSecurePreviewDocument } from "@/lib/preview/secure-document";

const STARTER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My first live preview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      padding: 24px; background: #07111f; color: #effaff;
      font-family: system-ui, sans-serif; }
    .card { width: min(100%, 360px); padding: 28px; border-radius: 24px;
      border: 1px solid #1d526c; background: linear-gradient(145deg,#102a40,#091522);
      box-shadow: 0 20px 70px #0008; }
    .eyebrow { color: #4ee7ef; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
    h1 { margin: 12px 0; font-size: 30px; }
    p { color: #a8bdca; line-height: 1.6; }
    button { border: 0; border-radius: 12px; padding: 12px 16px;
      background: #4ee7ef; color: #06121d; font-weight: 800; cursor: pointer; }
    #count { color: #4ee7ef; font-size: 34px; font-weight: 800; }
  </style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">LUXORA LIVE PREVIEW</div>
    <h1>Your code, running.</h1>
    <p>Edit this HTML or paste your own page into the editor. Then refresh the preview.</p>
    <div id="count">0</div>
    <button onclick="document.getElementById('count').textContent = Number(document.getElementById('count').textContent) + 1">
      Test interaction
    </button>
  </main>
</body>
</html>`;

type Viewport = "mobile" | "desktop";

export default function LivePreviewWorkspace() {
  const [source, setSource] = useState(STARTER_HTML);
  const [viewport, setViewport] = useState<Viewport>("mobile");
  const [revision, setRevision] = useState(1);
  const [previewSource, setPreviewSource] = useState(STARTER_HTML);
  const [copied, setCopied] = useState(false);

  const previewDocument = useMemo(
    () => createSecurePreviewDocument(previewSource),
    [previewSource]
  );

  function refreshPreview() {
    setPreviewSource(source);
    setRevision((current) => current + 1);
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="preview-workspace">
      <header className="preview-topbar">
        <a className="preview-brand" href="/" aria-label="Return to LUXORA AI">
          <span className="preview-brand-mark">L</span>
          <span>LUXORA <strong>AI</strong></span>
        </a>
        <div className="preview-topbar-title"><span className="preview-live-dot" /> Live Preview <span className="preview-beta">EARLY ACCESS</span></div>
        <a className="preview-back-link" href="/">Back to chat</a>
      </header>

      <section className="preview-heading">
        <div>
          <p className="preview-eyebrow">BUILD · RUN · ITERATE</p>
          <h1>See your code come to life.</h1>
          <p>Paste an HTML page, edit it, and test the result in an isolated preview.</p>
        </div>
        <div className="preview-actions">
          <button className="preview-secondary" type="button" onClick={copySource}>{copied ? "Copied" : "Copy code"}</button>
          <button className="preview-primary" type="button" onClick={refreshPreview}>↻ Run preview</button>
        </div>
      </section>

      <section className="preview-workbench" aria-label="Code editor and live preview">
        <div className="preview-editor-panel">
          <div className="preview-panel-bar">
            <div><span className="preview-panel-dot" /> <strong>index.html</strong></div>
            <span>HTML</span>
          </div>
          <textarea
            className="preview-code-editor"
            aria-label="HTML source editor"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <div className="preview-editor-footer">
            <span>{source.length.toLocaleString()} characters</span>
            <span>Revision {revision}</span>
          </div>
        </div>

        <div className="preview-render-panel">
          <div className="preview-panel-bar preview-render-toolbar">
            <div><span className="preview-panel-dot preview-panel-dot-live" /> <strong>Preview</strong></div>
            <div className="preview-viewport-switch" role="group" aria-label="Preview size">
              <button type="button" aria-pressed={viewport === "mobile"} className={viewport === "mobile" ? "selected" : ""} onClick={() => setViewport("mobile")}>▯ Mobile</button>
              <button type="button" aria-pressed={viewport === "desktop"} className={viewport === "desktop" ? "selected" : ""} onClick={() => setViewport("desktop")}>▱ Desktop</button>
            </div>
          </div>
          <div className="preview-canvas">
            <div className={`preview-device ${viewport === "mobile" ? "device-mobile" : "device-desktop"}`}>
              <iframe
                key={revision}
                title="Rendered HTML live preview"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                srcDoc={previewDocument}
              />
            </div>
          </div>
          <div className="preview-render-footer">
            <span><span className="preview-panel-dot preview-panel-dot-live" /> Preview ready · isolated sandbox</span>
            <span>Rendered revision {revision}</span>
          </div>
        </div>
      </section>
      <p className="preview-footnote">This first release previews a single HTML document. External network requests and form submissions are restricted. It does not connect to live BingwaPulse data or deploy your project.</p>
    </main>
  );
}
