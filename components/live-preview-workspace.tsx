"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSecurePreviewDocument } from "@/lib/preview/secure-document";

const STARTER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard Preview</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:22px;background:#07111d;color:#eff8ff;font-family:Arial,sans-serif}
main{max-width:760px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;gap:12px}
small{color:#91a9bd}.eyebrow{color:#39d9e8;font-size:11px;letter-spacing:2px;font-weight:800}
h1{font-size:27px;margin:8px 0}.balance{margin-top:24px;padding:22px;border:1px solid #1b8196;border-radius:18px;background:linear-gradient(130deg,#102c40,#0b1828)}
.amount{font-size:34px;font-weight:800;color:#39d9e8;margin:8px 0}.button,.tabs button{padding:10px 13px;border:1px solid #24566c;border-radius:10px;background:#102b40;color:#e9fcff;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.tile{padding:15px;border:1px solid #1c3549;border-radius:14px;background:#0e1c2c}.tile strong{display:block;font-size:20px;margin-top:8px}
.tabs{display:flex;gap:8px;margin-top:24px;border-bottom:1px solid #294153;padding-bottom:10px}.tabs button.active{background:#39d9e8;color:#07111d;font-weight:800}
#panel{padding:20px 4px;min-height:110px;color:#c4d8e8}
@media(max-width:460px){body{padding:16px}.grid{grid-template-columns:1fr}h1{font-size:23px}}
</style>
</head>
<body>
<main>
<div class="top"><div><div class="eyebrow">LUXORA LIVE PREVIEW</div><h1>Business dashboard</h1><small>Interactive sample project</small></div><button class="button" onclick="refreshBalance()">↻ Refresh</button></div>
<section class="balance"><small>Available balance</small><div class="amount" id="balance">KES 8,920.00</div><small id="updated">Demo balance · no payment service connected</small></section>
<section class="grid"><div class="tile"><small>Orders today</small><strong>12</strong></div><div class="tile"><small>Completed</small><strong>10</strong></div><div class="tile"><small>Pending</small><strong>2</strong></div></section>
<nav class="tabs"><button class="active" onclick="showTab('Overview',this)">Overview</button><button onclick="showTab('Transactions',this)">Transactions</button><button onclick="showTab('Analytics',this)">Analytics</button></nav>
<section id="panel"><strong>Overview</strong><p><small>Try the tabs and refresh button to test this live preview.</small></p></section>
</main>
<script>
function showTab(name,button){document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));button.classList.add('active');document.getElementById('panel').innerHTML='<strong>'+name+'</strong><p><small>'+name+' section selected in the demo.</small></p>'}
function refreshBalance(){const b=document.getElementById('balance'),u=document.getElementById('updated');b.textContent='Refreshing…';setTimeout(()=>{b.textContent='KES 8,920.00';u.textContent='Demo refresh completed · no live account contacted'},450)}
</script>
</body>
</html>`;

type PreviewMessage = { type: "luxora-preview-error"; message?: string };

export default function LivePreviewWorkspace() {
  const [source, setSource] = useState(STARTER_HTML);
  const [renderedSource, setRenderedSource] = useState(STARTER_HTML);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");
  const [revision, setRevision] = useState(1);
  const [runtimeError, setRuntimeError] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const previewDocument = useMemo(
    () => createSecurePreviewDocument(renderedSource),
    [renderedSource, revision]
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent<PreviewMessage>) {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== "null") return;
      if (event.data?.type === "luxora-preview-error") {
        setRuntimeError(String(event.data.message || "A runtime error occurred").slice(0, 500));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function runPreview() {
    setRuntimeError("");
    setPreviewReady(false);
    setRenderedSource(source);
    setRevision(value => value + 1);
  }

  function resetDemo() {
    setSource(STARTER_HTML);
    setRenderedSource(STARTER_HTML);
    setRuntimeError("");
    setPreviewReady(false);
    setRevision(value => value + 1);
  }

  return (
    <main className="preview-workspace">
      <header className="preview-topbar">
        <a className="preview-brand" href="/" aria-label="LUXORA AI home">
          <span className="preview-brand-mark">L</span><span>LUXORA <strong>AI</strong></span>
        </a>
        <div className="preview-topbar-title"><span className="preview-live-dot" /> Live Preview <span className="preview-beta">FIRST RELEASE</span></div>
        <a className="preview-back-link" href="/">← Back to chat</a>
      </header>

      <section className="preview-heading">
        <div><p className="preview-eyebrow">BUILD · TEST · REFINE</p><h1>Your code, running live.</h1><p>Paste an HTML page, run it in an isolated preview, and test its interactions.</p></div>
        <div className="preview-actions">
          <button className="preview-secondary" type="button" onClick={resetDemo}>Reset demo</button>
          <button className="preview-primary" type="button" onClick={runPreview}>▶ Run preview</button>
        </div>
      </section>

      <section className="preview-workbench" aria-label="Live preview workspace">
        <section className="preview-editor-panel">
          <div className="preview-panel-bar"><div><span className="preview-panel-dot" /><strong>index.html</strong></div><span>HTML · CSS · JS</span></div>
          <label className="sr-only" htmlFor="preview-source">HTML source code</label>
          <textarea id="preview-source" className="preview-code-editor" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={source} onChange={event => setSource(event.target.value)} aria-label="HTML source code editor" />
          <div className="preview-editor-footer"><span>{source.length.toLocaleString()} characters</span><span>Edits apply when you run preview</span></div>
        </section>

        <section className="preview-render-panel">
          <div className="preview-panel-bar">
            <div><span className={`preview-panel-dot ${previewReady ? "preview-panel-dot-live" : ""}`} /><strong>Rendered page</strong></div>
            <div className="preview-viewport-switch" aria-label="Preview size">
              <button type="button" className={viewport === "mobile" ? "selected" : ""} aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>▯ Mobile</button>
              <button type="button" className={viewport === "desktop" ? "selected" : ""} aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>▭ Desktop</button>
            </div>
          </div>
          <div className="preview-canvas">
            <div className={`preview-device ${viewport === "mobile" ? "device-mobile" : "device-desktop"}`}>
              <iframe key={revision} ref={frameRef} title="Isolated HTML live preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewDocument} onLoad={() => setPreviewReady(true)} />
            </div>
          </div>
          <div className="preview-render-footer"><span><span className="preview-panel-dot preview-panel-dot-live" />{previewReady ? "Preview running" : "Loading preview…"}</span><span>Revision {revision}</span></div>
          {runtimeError && <p className="preview-error" role="alert">Runtime error: {runtimeError}</p>}
        </section>
      </section>

      <p className="preview-footnote">Preview code runs in a sandboxed frame without same-origin access. Network requests and form submissions are blocked. This is a local visual preview, not a deployed site; demo data and actions do not connect to live services.</p>
    </main>
  );
}