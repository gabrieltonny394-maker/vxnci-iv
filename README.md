# VX NCI IV

VX NCI IV is an independent AI assistant project being developed under **LUXORA CLUB**.

## Vision

Build a capable, standalone AI assistant with a dedicated interface and a foundation for:
- Conversational assistance
- Context and conversation history
- Model-provider integration and model selection
- Software development assistance
- Agentic workflows and software creation capabilities over time

## Project structure

LUXORA CLUB is the parent company. VX NCI IV is one of its independent projects. Other LUXORA CLUB projects, including CREOVA and the Software Creation Tool, remain separate products.

## Current development status

**Stage:** Initial web application scaffold.

The development branch now contains a Next.js App Router and TypeScript foundation, a responsive ChatGPT-style interface shell, and base styling. The interface intentionally indicates that the AI engine is not connected yet. No live AI responses, saved conversation history, accounts, file uploads, or voice features are implemented.

The scaffold has not yet been build-tested in CI or deployed. See [the MVP build plan](docs/BUILD_PLAN.md) for the phased roadmap and verification criteria.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To create a production build:

```bash
npm run build
npm run start
```

## Development principles

- Build and verify real functionality; label plans and prototypes honestly.
- Keep provider credentials and secrets out of source control and client-side code.
- Prefer free-tier services during early development.
- Do not enable paid services or incur costs without explicit approval.
- Keep the `main` branch stable and use dedicated development branches for ongoing work.

## Next steps

1. Verify the application scaffold with an automated production build.
2. Define the provider-neutral AI interface and server endpoint.
3. Connect one approved free-tier model provider securely.
4. Implement real conversations and browser-local history.
