# LUXORA AI — Verified Software Quality Standard

**Status:** Foundational product requirement  
**Applies to:** LUXORA AI assistant, code generation, app/site builder, live preview, generated projects, and deployment guidance.

This standard turns a central product requirement into testable engineering rules: LUXORA AI must produce and verify working software, not merely attractive screens or convincing demonstrations.

## 1. Core rule

LUXORA AI must never describe a generated application, feature, preview, or workflow as working, tested, or production-ready unless the relevant behavior has actually been exercised and the evidence supports that claim.

A successful render is not proof of functionality. A successful build is not proof that every workflow works. A passing test suite is not proof that untested behavior works.

## 2. Required preview behavior

A live preview must run the actual generated application or a clearly disclosed, constrained preview of it. It must not silently substitute a static mockup while implying that the app is interactive.

For each generated preview:

- Buttons and links must perform their stated actions.
- Forms must validate input, report errors, and complete their intended submission path (or clearly identify mocked/unavailable services).
- Navigation must lead to the correct destinations and preserve expected state.
- Interactive charts, filters, menus, dialogs, and controls must respond to user input.
- Loading, empty, success, and failure states must be represented.
- Backend-dependent actions must disclose when a backend, credentials, network, or external service is not connected.
- Preview failures must be visible; a blank screen or frozen control must not be presented as success.

## 3. Verification before status claims

The builder should run the checks applicable to the project and record their outcomes:

1. Dependency and environment checks.
2. Static analysis, linting, and type checking where configured.
3. Production build or export.
4. Runtime startup and browser/app load.
5. Runtime error capture, including uncaught exceptions and failed resource loads.
6. Network/request failure inspection where relevant.
7. Automated interaction tests for critical workflows.
8. Manual or agent-driven smoke tests for important paths not covered by automation.

Verification must distinguish checks that were run, checks that passed, checks that failed, and checks that were not run. Never turn missing evidence into a pass.

## 4. Actionable debugging

When a preview or generated project fails, LUXORA AI should surface:

- The failing route, component, action, or workflow.
- The relevant error message and stack/context when available.
- Failed network requests and status codes when available.
- A concise explanation of likely cause, clearly marked as a hypothesis when unconfirmed.
- A proposed repair and the specific check that will verify the repair.

Logs should be accessible without overwhelming ordinary users. Sensitive values, credentials, tokens, and private user data must be redacted.

## 5. Honest lifecycle labels

Use explicit lifecycle labels. The label must reflect the strongest state supported by current evidence:

| Label | Meaning |
| --- | --- |
| **Prototype** | A concept or partial implementation. It may contain placeholders and unimplemented actions. |
| **Preview running** | The application starts and renders, but critical interactions have not all been verified. |
| **Interaction-tested** | Named critical workflows have been exercised and passed the recorded tests. |
| **Build verified** | The configured production build/export completed successfully. This does not imply every workflow works. |
| **Release candidate** | Required build, runtime, security, and critical-workflow checks passed for the stated target environment; remaining limitations are disclosed. |
| **Production-ready** | All project-defined release gates passed in the target production-like environment, with operational, security, recovery, and monitoring requirements satisfied. This label requires explicit evidence. |

Do not collapse these labels into a single vague “complete” or “100% ready” status.

## 6. Evidence record

Every verification report should identify:

- Project and tested revision.
- Environment and relevant runtime versions.
- Checks executed and their results.
- Critical workflows tested and their outcomes.
- Known failures, skipped checks, mocks, and external dependencies.
- Timestamp of the run.
- Whether the evidence came from automation, manual testing, or both.

A test result applies only to the revision and environment that were tested. Changes after the run invalidate affected evidence and require retesting.

## 7. Failure handling

- Fail visibly and preserve diagnostic evidence.
- Do not silently swallow exceptions or convert failed operations into success messages.
- Do not claim a fix until the relevant regression check passes.
- If verification cannot run, state why and keep the status unverified.
- Keep user data and generated project files safe when retrying or repairing.

## 8. Security and cost boundaries

- Never expose API keys, credentials, tokens, or secrets in generated client code, logs, screenshots, or source control.
- Do not activate paid services, incur charges, deploy publicly, or send live messages without the user's explicit approval.
- Use mocks only when they are clearly labeled and cannot be mistaken for live integrations.
- Treat generated code and external tool output as untrusted until reviewed and tested.

## 9. Initial implementation sequence

Because the repository currently contains only its project README, this standard is being established as a product contract first. It is not evidence that a preview engine, test runner, or debugging interface has already been implemented.

Implement the capabilities in this order as the application foundation is built:

1. Establish a project/run model that records revision, environment, and lifecycle state.
2. Add preview process health and visible startup/runtime failure reporting.
3. Capture browser/runtime errors and failed resource/network requests.
4. Add smoke tests for navigation, buttons, forms, and other generated interactions.
5. Add build, typecheck, lint, and test gates to continuous integration.
6. Present the evidence record and lifecycle label in the builder UI.
7. Add release-candidate and production-readiness gates only after security, deployment, monitoring, and recovery checks exist.

## 10. Definition of done for this standard

This standard is considered implemented in the product only when:

- Every lifecycle label is backed by recorded evidence.
- A rendered preview cannot be mistaken for a verified working application.
- Critical interactions have executable tests or are explicitly marked unverified.
- Runtime errors and failed requests are visible and actionable.
- Failed checks prevent stronger readiness claims.
- The user can see what was tested, what passed, what failed, and what remains unknown.

**Non-negotiable:** LUXORA AI must prove functionality before claiming functionality.
