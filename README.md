# LUXORA AI

LUXORA AI is an independent AI assistant project being developed under **LUXORA CLUB**. The repository name remains vxnci-iv.

## Vision

Build a capable, standalone AI assistant with reliable multi-turn conversations, reasoning, writing, coding, everyday assistance, and a provider-independent model interface.

Planned model tiers: **LUXORA Core**, **LUXORA Nova**, **LUXORA Titan**, and **LUXORA Apex**. These are product targets, not claims that those models are already available.

## Current implementation status

**Lifecycle: Prototype.**

The repository currently includes:
- A responsive browser chat interface served by the Node.js application.
- A validated conversation API with request-size and message-length limits.
- A Gemini adapter using Google's Interactions API and gemini-3.8-flash by default.
- Stateless Gemini requests (store:false) with exact model steps retained in process memory for multi-turn context.
- A provider interface that keeps Gemini replaceable by LUXORA's own model provider.
- Health reporting, structured API errors, and automated tests.

**Not production-ready:** conversation state and Gemini step history are held in process memory and disappear when the server restarts. There is no authentication, user account system, durable database, rate limiting, streaming response, or production deployment. The Gemini adapter has not been live-tested until a valid API key is configured. A successful page load is not proof that model generation works.

## Run locally

Requires Node.js 22 or later.

1. Copy .env.example to .env.
2. Create a Gemini API key in Google AI Studio: https://aistudio.google.com/app/apikey
3. Put the key in GEMINI_API_KEY in .env. Never paste it into chat or commit it to GitHub.
4. Keep GEMINI_MODEL=gemini-3.8-flash unless you intentionally choose another model available to your API key.
5. Run:

\`\`\`bash
npm test
npm run check
npm start
\`\`\`

Open http://localhost:3000.

The Gemini Developer API has a free tier for eligible models and usage, subject to current limits and terms. Do not enable billing or upgrade to a paid tier for this project without explicit approval. Google states that free-tier data may be used to improve its products; do not submit confidential information through the free tier.

## Security and development principles

- Keep API keys server-side in .env; never put secrets in browser JavaScript or source control.
- .env is ignored by Git; .env.example contains placeholders only.
- Prefer free-first development.
- Do not enable paid services, incur charges, deploy publicly, or send live messages without explicit approval.
- Keep main stable and use dedicated development branches.
- Build and verify real functionality; label prototypes and limitations honestly.

## Verified software quality

LUXORA AI must prove that generated software works before claiming that it works. A rendered screen or successful build alone is not proof of functional correctness.

See [Verified Software Quality Standard](docs/VERIFIED_SOFTWARE_QUALITY_STANDARD.md).
