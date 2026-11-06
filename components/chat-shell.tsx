"use client";

import { useState } from "react";

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span>V</span>
    </div>
  );
}

export default function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <a className="brand" href="/" aria-label="VX NCI IV home">
            <BrandMark />
            <span className="brand-name">VX NCI IV</span>
          </a>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button className="new-chat-button" type="button" disabled>
          <span className="plus-icon">＋</span>
          <span>New chat</span>
        </button>

        <div className="history-area">
          <p className="sidebar-label">Your conversations</p>
          <div className="history-empty">
            <span className="history-empty-icon">▤</span>
            <p>Your chats will appear here.</p>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-avatar">V</div>
          <div className="profile-copy">
            <strong>VX NCI IV</strong>
            <span>Independent AI assistant</span>
          </div>
          <span className="profile-menu" aria-hidden="true">···</span>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              ☰
            </button>
            <span className="mobile-brand">VX NCI IV</span>
            <span className="model-label">AI Assistant <span className="chevron">⌄</span></span>
          </div>
          <div className="topbar-right">
            <span className="status-dot" />
            <span className="status-text">Setup in progress</span>
          </div>
        </header>

        <div className="conversation-stage">
          <div className="welcome-block">
            <div className="welcome-mark"><BrandMark /></div>
            <p className="eyebrow">A new kind of assistant</p>
            <h1>What can I help you with?</h1>
            <p className="welcome-subtitle">
              Think, create, learn and build — all in one place.
            </p>

            <div className="suggestion-grid" aria-label="Example capabilities">
              <div className="suggestion-card">
                <span className="suggestion-icon green">✳</span>
                <div>
                  <strong>Explore ideas</strong>
                  <span>Think through something new</span>
                </div>
              </div>
              <div className="suggestion-card">
                <span className="suggestion-icon blue">⌘</span>
                <div>
                  <strong>Write and create</strong>
                  <span>Turn thoughts into clear words</span>
                </div>
              </div>
              <div className="suggestion-card">
                <span className="suggestion-icon amber">⌁</span>
                <div>
                  <strong>Learn something</strong>
                  <span>Understand a topic step by step</span>
                </div>
              </div>
              <div className="suggestion-card">
                <span className="suggestion-icon violet">⟨/⟩</span>
                <div>
                  <strong>Build with code</strong>
                  <span>Plan and solve technical problems</span>
                </div>
              </div>
            </div>
          </div>

          <div className="composer-wrap">
            <div className="setup-notice" role="status">
              <span className="notice-icon">i</span>
              The AI engine is not connected yet. Chat will become available after setup.
            </div>
            <div className="composer composer-disabled">
              <textarea
                aria-label="Message VX NCI IV"
                placeholder="Set up the AI engine to start a conversation..."
                rows={1}
                disabled
              />
              <div className="composer-actions">
                <button className="composer-tool" type="button" disabled aria-label="Attach a file">＋</button>
                <span className="composer-hint">AI connection pending</span>
                <button className="send-button" type="button" disabled aria-label="Send message">↑</button>
              </div>
            </div>
            <p className="disclaimer">
              VX NCI IV is an independent project by LUXORA CLUB. It is not affiliated with OpenAI.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}