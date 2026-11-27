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

## Development status

**Stage:** Initial repository foundation.

This repository is currently being initialized. Features listed in the vision are goals, not claims of implemented functionality.

## Foundational quality requirement

LUXORA AI must prove that generated software works before claiming that it works. A rendered screen or successful build alone is not proof of functional correctness. The project will use explicit lifecycle labels, runtime diagnostics, interaction testing, and evidence-backed release gates.

See [Verified Software Quality Standard](docs/VERIFIED_SOFTWARE_QUALITY_STANDARD.md) for the requirements and implementation sequence. This document is a product contract; it does not claim that the preview engine or verification tooling already exists.

## Development principles

- Build and verify real functionality; label plans and prototypes honestly.
- Keep provider credentials and secrets out of source control and client-side code.
- Prefer free-tier services during early development.
- Do not enable paid services or incur costs without explicit approval.
- Keep the `main` branch stable and use dedicated development branches for ongoing work.

## Next steps

1. Establish the development branch and project structure.
2. Define the application architecture and provider interface.
3. Build the first working web application incrementally.
4. Implement the verification capabilities defined in the [quality standard](docs/VERIFIED_SOFTWARE_QUALITY_STANDARD.md).
5. Add persistence and authentication only after their design and security requirements are clear.
