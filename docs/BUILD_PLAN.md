# VX NCI IV — Independent AI Platform Build Plan

**Status:** Product direction approved; implementation is in progress  
**Parent company:** LUXORA CLUB  
**Working branch:** `develop/vxnci-foundation`

This document records the intended product architecture. It is not evidence that planned AI capabilities have already been implemented.

## 1. Product vision and ownership

VX NCI IV is intended to become an independent AI platform with its own product identity, application, orchestration layer, model infrastructure, tools, and eventually proprietary models.

The goal is not to build a thin wrapper around ChatGPT, Claude, or Gemini. VX NCI IV must own the application and the systems that coordinate its intelligence. It may optionally connect to third-party model APIs during development or as user-selectable integrations, but it must not depend permanently on any one external provider.

We will not copy proprietary source code, private model weights, branding, or confidential systems belonging to other companies.

## 2. AI provider identity and model naming

The user's approved name for the AI technology division/provider is **VXNCI Intelligence**. It sits under LUXORA CLUB and powers the VX NCI IV assistant.

The planned first proprietary model family begins with **VXNCI-1**. This is a naming decision, not a claim that the model has already been trained or implemented. Future model generations may use sequential names (for example, VXNCI-2) if that naming remains appropriate.

VXNCI Intelligence is the intended owner-facing identity for the model runtime, orchestration, and future proprietary model research. External model APIs and open-weight models may be used as replaceable development components, but must be disclosed accurately and must not be represented as proprietary VXNCI models.

## 3. Independence strategy

Build independence in stages rather than pretending that a new foundation model can be trained immediately without substantial data, compute, expertise, and funding.

### Stage A — Own the AI platform core

Build and control:
- A provider-neutral model interface and routing layer.
- Conversation orchestration and context assembly.
- Tool/function execution with permission and safety checks.
- Model configuration, usage accounting, and cost controls.
- Our own chat history and memory architecture, with clear privacy controls.
- Evaluation, logging, and quality measurement that avoid storing secrets or unnecessary sensitive content.

### Stage B — Operate open-weight models

Evaluate appropriately licensed open-weight models and run them through infrastructure we control where practical. Start with modest models and hardware/cloud options that fit the available budget. Verify each model's licence, hardware requirements, quality, and deployment terms before adoption.

### Stage C — Adapt models we can legally modify

Build curated datasets and evaluation suites. Experiment with fine-tuning or other adaptation methods only where the model licence permits it and where the data is lawfully obtained and suitable for training.

### Stage D — Develop proprietary models

Work toward VX NCI IV-owned model checkpoints and, eventually, a foundation model trained from the ground up if resources and evidence justify that investment. This is a long-term research and infrastructure programme, not an MVP promise.

## 4. First usable product

The first release remains a responsive text-chat application:
- Start, view, and manage conversations.
- Send messages and receive real model responses.
- Show loading, cancellation where supported, and useful error states.
- Preserve chat history locally at first, with clear disclosure.
- Support desktop and mobile browsers.
- Keep the model integration behind a server-side interface.

For the earliest working release, a permitted open-weight model hosted in an environment we control is the preferred independence path if it can be run reliably and affordably. A third-party API may be used temporarily only if separately approved; it must remain replaceable and must not be described as our own model.

## 5. Technical architecture

Current application foundation:
- Next.js with TypeScript and the App Router.
- Server-side API routes for chat and orchestration.
- Provider/model adapter boundary.
- Browser-local conversation storage for the initial MVP.
- GitHub repository `gabrieltonny394-maker/vxnci-iv`.
- Active development branch: `develop/vxnci-foundation`; keep `main` stable.

The detailed VXNCI Intelligence architecture, including module boundaries, model-neutral contracts, routing, safety, runtime strategy, and implementation sequence, is documented in [AI_CORE_ARCHITECTURE.md](./AI_CORE_ARCHITECTURE.md).

Current AI Core code boundaries include:

```text
app/api/chat/route.ts
lib/ai/
  contracts.ts
  model-router.ts
  orchestration.ts
  safety.ts
.env.example
```

The model adapter registry is currently empty. The API route validates input and returns a clear service-unavailable response until a real model adapter is configured. It does not generate simulated AI answers.

## 6. Development phases

### Phase 0 — Foundation
- [x] Create the initial Next.js/TypeScript scaffold on the development branch.
- [x] Record the independent AI platform direction in this plan.
- [x] Write the VXNCI Intelligence AI Core architecture specification.
- [x] Add an environment configuration example without real secrets.
- [ ] Verify a successful application build.
- [ ] Confirm the practical local development and deployment path.

### Phase 1 — Functional chat
- [ ] Implement real conversation state and message sending in the client.
- [ ] Add clear loading, error, retry, and cancellation behavior.
- [ ] Add browser-local chat persistence.
- [ ] Test responsive desktop and mobile layouts.

### Phase 2 — VX NCI IV AI Core
- [x] Define initial model-neutral request and response TypeScript contracts.
- [x] Add a server-side model adapter registry and router boundary.
- [x] Add initial orchestration and request validation.
- [x] Add an API route that rejects invalid requests and clearly reports an unconfigured model runtime.
- [ ] Add automated tests for contracts, validation, routing, and API behavior.
- [ ] Implement and register a real model adapter.
- [ ] Add production-grade rate limits, output checks, and operational monitoring.

### Phase 3 — Independent model runtime
- [ ] Research open-weight models and their licences.
- [ ] Measure model quality, latency, memory/compute requirements, and hosting costs.
- [ ] Select a model only after a practical test.
- [ ] Deploy a model runtime only when it can be operated within approved resources.
- [ ] Verify the application can use the runtime through the same model interface.

### Phase 4 — Model adaptation and proprietary research
- [ ] Define lawful data sourcing, consent, retention, and dataset governance.
- [ ] Build repeatable evaluation datasets and benchmarks.
- [ ] Explore fine-tuning only where permitted and affordable.
- [ ] Track whether adaptation measurably improves VX NCI IV tasks.
- [ ] Assess the feasibility of training proprietary models from scratch before committing resources.

### Phase 5 — Quality and release
- [ ] Test reliability, privacy, accessibility, security, and abuse resistance.
- [ ] Verify deployment end to end.
- [ ] Publish accurate model/provider disclosures and limitations.
- [ ] Do not call the product or model independent beyond what has actually been implemented and verified.

## 7. Security, privacy, and cost rules

- Never commit API keys, passwords, tokens, or service-role credentials.
- Keep secrets server-side and out of logs, client bundles, and public configuration.
- Do not enable paid services, paid model calls, subscriptions, or billing without explicit approval.
- Do not provision paid compute or deploy a hosted model that incurs charges without explicit approval.
- Check model licences, provider terms, data handling, and hardware requirements before use.
- Do not use private or sensitive user conversations as training data by default.
- Provide clear controls and disclosures for conversation storage and any future memory.
- Validate requests and apply rate/size limits before public deployment.

## 8. Truthful implementation status

The repository now contains the early Next.js application scaffold, a static chat shell, the AI Core architecture specification, initial model contracts, a model router boundary, request validation, orchestration scaffolding, and a server chat route.

This is an initial backend foundation, not a functioning AI assistant. No model adapter is registered, no AI model is connected, and chat requests cannot yet produce model answers. The client composer remains disabled. Local chat persistence, user accounts, and proprietary model weights are not implemented. The application build has not yet been successfully verified.

VX NCI IV may be described as having its own AI platform only as the relevant modules are implemented and tested. It may be described as having its own model only when a VX NCI IV model checkpoint has actually been developed and verified.

## 9. Immediate next steps

1. Verify the existing application build and type-check the new backend modules.
2. Add automated tests for request validation and model routing.
3. Implement client-side chat state and connect the composer to the server route.
4. Evaluate open-weight models against the available hardware and budget before choosing one.
5. Implement a real model runtime only after the feasibility review.

All development stays on `develop/vxnci-foundation`. Do not modify `main`, add credentials, enable paid services, or incur hosting/model costs without explicit approval.
