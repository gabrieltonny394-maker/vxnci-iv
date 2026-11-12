# LUXORA Live Preview Product Specification

**Status:** Approved product requirement for implementation planning  
**Product:** LUXORA AI / LUXORA INTELLIGENCE  
**Applies to:** Core, Nova, Titan and Apex

## 1. Product requirement

Live Preview is a standard platform capability available across every LUXORA model tier. A user must be able to provide supported code, ask LUXORA to create or edit an interface, and inspect the rendered result without leaving the conversation or manually deploying the project.

Live Preview is not a capability that should be withheld solely to force a model-tier upgrade. Model tiers may have different usage limits and complexity allowances, but all tiers use the same underlying preview capability.

## 2. Responsibility split

Live Preview is a platform execution capability, not something a language model can provide by text generation alone.

- **Model:** Understands the request; generates, explains, edits and debugs source files.
- **Project workspace:** Stores the user's files and tracks revisions.
- **Preview runtime:** Builds and runs the supported project in an isolated environment.
- **Preview UI:** Displays the rendered application and exposes viewport controls, refresh, and runtime/build errors.
- **Conversation orchestrator:** Connects model edits to the project revision and requests a preview refresh, while preserving the user's conversation and project history.

A model must never claim that code is running or previewed unless the runtime confirms that it started successfully and the preview is available.

## 3. Tier expectations

| Model tier | Minimum expected preview workflow |
|---|---|
| **LUXORA Core — Entry** | Open and inspect supported existing HTML/CSS/JavaScript projects; make straightforward edits; refresh the preview. |
| **LUXORA Nova — Advanced** | Generate complete responsive interfaces, edit multiple related files, and resolve common preview/build errors. |
| **LUXORA Titan — Expert** | Work with larger multi-file applications, debug complex interactions, and manage more involved project changes. |
| **LUXORA Apex — Flagship** | Handle the most complex supported projects, architecture changes, advanced debugging and larger iterative preview workflows. |

All tiers share the preview engine and security boundaries. Limits may differ by tier, but the basic ability to see supported code rendered must remain available.

## 4. Initial supported experience

The first release should support a self-contained HTML page with CSS and JavaScript, including common CDN assets where network policy permits them.

For a pasted HTML dashboard, the user should be able to:
1. Open a rendered preview automatically or with one clear action.
2. Switch between mobile and desktop viewport sizes.
3. Interact with page controls, navigation, forms and client-side scripts.
4. Refresh the preview after code changes.
5. Ask for a change in natural language and see the resulting revision.
6. Inspect actionable syntax, runtime and build errors.
7. Return to earlier project revisions without losing the conversation.

The first release must clearly distinguish demo/sample data and simulated actions from live production data or real external transactions.

## 5. Expansion path

After reliable static HTML preview, expand deliberately to:
- Multi-file HTML/CSS/JavaScript projects.
- Common frontend frameworks and package-managed projects.
- Responsive device presets and resizable viewports.
- Console and build diagnostics.
- Version history, restore and compare.
- Download/export and, separately, deployment workflows.

Do not advertise a framework or runtime as supported until it has passed automated and manual compatibility tests.

## 6. Security and privacy requirements

Untrusted user code must execute in an isolated, disposable sandbox, separated from the LUXORA application server and other users' workspaces.

The implementation must:
- Never expose model-provider keys, environment secrets, session cookies, internal credentials or server filesystem access to preview code.
- Enforce CPU, memory, execution-time, storage and output limits.
- Apply a restrictive network policy; external resource loading must be controlled and must not allow access to private/internal network addresses or cloud metadata endpoints.
- Prevent one user's preview from reading or modifying another user's files or processes.
- Sanitize and safely display logs and error output.
- Require explicit user approval for actions that create external side effects, incur costs, access private systems, or publish/deploy a project.
- Provide a clear stop/terminate control and clean up abandoned preview processes.

A browser iframe alone is not a sufficient isolation boundary for arbitrary server-side code or package scripts.

## 7. UX and continuity

Live Preview should be available alongside the conversation and code workspace. On mobile, the user must be able to switch between code and preview without losing either.

Code edits must be versioned. Failed builds or preview restarts must preserve the last working preview and the source revision; the assistant should explain the blocker and allow safe retry without discarding completed work.

The preview must never silently overwrite the user's source files with generated changes. Show or preserve revisions so the user can review and restore them.

## 8. Acceptance criteria

The feature is not complete until tests demonstrate:
- A pasted HTML page renders in a preview.
- JavaScript interactions work in the preview.
- Mobile and desktop viewport changes work.
- A model-generated edit creates a new revision and refreshes the preview.
- A syntax/runtime error is reported without falsely claiming success.
- The previous source revision and last known working preview remain recoverable after a failed edit.
- Preview code cannot access application secrets, other users' files, internal network services or host credentials.
- Core, Nova, Titan and Apex can all access the supported preview workflow under their respective usage limits.

## 9. Scope and honest status

This document establishes a product requirement and implementation target. It does not mean that the live preview runtime, sandbox, editor or user interface has already been built. No public deployment, paid compute, paid hosting, paid APIs or external service is authorised by this specification.

## 10. Implementation progress — first HTML milestone

The first HTML-only workspace is now implemented in the development branch:
- Route: `/preview`.
- Editable single-file HTML source with a runnable preview.
- Mobile and desktop viewport modes.
- Manual run/refresh and reset-to-demo controls.
- A small interactive dashboard starter project.
- Runtime error reporting for uncaught script errors and unhandled promise rejections.
- Preview rendered in an iframe sandbox with scripts enabled but same-origin access withheld.
- A restrictive Content Security Policy blocks network connections, form submissions, nested frames, workers and unapproved resource types. The Tailwind CDN, Google Fonts and Font Awesome CDN used by the supplied example are explicitly allowed for script/style/font loading.

**Current limitations:** this is a first client-side HTML/CSS/JavaScript milestone, not a full arbitrary-code execution service. It does not run Node.js, package scripts, backend services or framework builds. It does not yet persist projects or revisions, connect model edits to the editor, provide a complete console/network inspector, or offer deployment. Browser-level penetration testing and manual device testing remain outstanding. Do not treat the iframe as a server-side sandbox for untrusted packages or backend code.

CI run [43161523937](https://github.com/gabrieltonny394-maker/vxnci-iv/actions/runs/43161523937) completed successfully for both the application build/tests and Python model tests. This verifies compilation and automated tests; it is not a substitute for browser security review or deployed-device validation.
