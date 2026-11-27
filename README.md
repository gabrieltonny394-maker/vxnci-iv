# VX NCI IV

VX NCI IV is an independent AI assistant project being developed under **LUXORA CLUB**. The product direction is **LUXORA AI**.

## Vision

Build a capable, standalone AI assistant with:
- Reliable multi-turn conversations and conversation history
- A provider-independent model interface and model selection
- Reasoning, writing, coding, and everyday assistance
- Software development and software creation capabilities over time

Planned model tiers: **LUXORA Core**, **LUXORA Nova**, **LUXORA Titan**, and **LUXORA Apex**. These are product targets, not claims that those models are already available.

## Project structure

LUXORA CLUB is the parent company. VX NCI IV / LUXORA AI is an independent project. CREOVA and the Software Creation Tool remain separate products.

## Current implementation status

**Lifecycle: Prototype.**

The repository now contains a minimal Node.js conversation API foundation:
- `GET /health` reports service and provider configuration status.
- `POST /v1/conversations/:id/messages` validates user messages and calls the configured provider interface.
- Conversation context is maintained in process memory for this initial increment.
- Automated tests cover health reporting, message validation, provider failure, and multi-turn context.
- GitHub Actions runs syntax checks and automated tests on matching pushes and pull requests.

**Important limitations:** no real AI model provider is connected yet. The default provider returns a clear 503 error instead of fabricating an AI answer. Conversation data is in-memory and is lost when the server restarts. No authentication, durable database, user interface, or production deployment is included yet.

## Run locally

Requires Node.js 22 or later.

```bash
npm test
npm run check
npm start
```

The API listens on port 3000 by default. Check `GET /health` to inspect its status.

## Verified software quality

LUXORA AI must prove that generated software works before claiming that it works. A rendered screen or successful build alone is not proof of functional correctness.

See [Verified Software Quality Standard](docs/VERIFIED_SOFTWARE_QUALITY_STANDARD.md). It is a product contract; implementation of the complete preview engine and verification tooling remains future work.

## Development principles

- Build and verify real functionality; label prototypes and limitations honestly.
- Keep provider credentials and secrets out of source control and client-side code.
- Prefer free-first development.
- Do not enable paid services, incur charges, deploy publicly, or send live messages without explicit approval.
- Keep `main` stable and use dedicated development branches.

## Next implementation steps

1. Connect a real model through the provider interface, with explicit configuration and secret handling.
2. Add durable conversation storage and authentication after their security design is reviewed.
3. Build the user-facing chat interface.
4. Add runtime diagnostics and the evidence-backed verification system.
5. Expand automated tests and release gates before any production-readiness claim.
