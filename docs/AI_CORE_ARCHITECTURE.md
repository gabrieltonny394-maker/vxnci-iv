# VXNCI Intelligence — AI Core Architecture

**Status:** Architecture specification; implementation not yet complete  
**Parent company:** LUXORA CLUB  
**First product:** VX NCI IV  
**Planned first proprietary model:** VXNCI-1  
**Repository branch:** `develop/vxnci-foundation`

This document defines the intended technical boundaries for VXNCI Intelligence. It is a design specification, not evidence that the modules, model runtime, or proprietary models are already working.

## 1. Architecture principles

1. **Own the platform layer:** VXNCI Intelligence owns request orchestration, model routing, tool permissions, context assembly, evaluation, and product-level controls.
2. **Model independence:** The application must not depend on one vendor's request format or SDK. Model-specific integrations stay behind adapters.
3. **Honest model identity:** An external API model or third-party open-weight checkpoint must be identified accurately. It must never be labelled VXNCI-1.
4. **Secure by default:** Credentials remain server-side. Tools require explicit permissions. User data is not training data by default.
5. **Budget-aware:** Local or self-managed inference is not automatically free; compute, storage, bandwidth, and operations must be assessed before deployment.
6. **Incremental delivery:** Build and test the platform interfaces before selecting expensive infrastructure or attempting model training.

## 2. Logical architecture

```text
VX NCI IV Web / Mobile Client
          |
          v
Application API (authentication, validation, rate limits)
          |
          v
VXNCI AI Core
  |       |        |         |
  |       |        |         +-- Safety and policy checks
  |       |        +------------ Context / conversation assembly
  |       +--------------------- Tool permission and execution
  +----------------------------- Model router
                                      |
                                      v
                               Model adapter contract
                                      |
                    +-----------------+------------------+
                    |                 |                  |
               Local runtime    Approved API       Evaluation / test
               (open weights)   adapter (optional) adapters
                    |
                    v
             Model checkpoint
       (third-party open weights initially;
        VXNCI-owned weights in a later phase)
```

## 3. Core modules

### A. Application API
- Accept chat requests from the web client.
- Validate message size, conversation identifiers, and supported options.
- Apply abuse controls, request limits, and timeouts.
- Stream assistant output when the selected runtime supports it.
- Return structured errors without exposing internal secrets or stack traces.

### B. Model-neutral contract
Define one internal request/response shape independent of any model vendor.

Initial conceptual TypeScript contract:

```ts
export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelRequest {
  messages: ChatMessage[];
  modelId: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ModelResponse {
  text: string;
  modelId: string;
  finishReason?: "stop" | "length" | "tool_call" | "unknown";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ModelAdapter {
  readonly providerId: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}
```

The first implementation should keep the contract deliberately small. Streaming, multimodal inputs, tool calls, and structured output can be added as explicit capabilities rather than assumed to work for every model.

### C. Model router
- Resolve a configured logical model ID to an adapter and model checkpoint.
- Support a default model and an allowlisted set of alternatives.
- Reject unknown or disabled model IDs.
- Record model/version metadata for diagnostics.
- Never silently route to a paid provider or a different model.

### D. Orchestration and context
- Assemble the current user request and permitted conversation history.
- Apply system-level product instructions.
- Enforce context-window and input-size limits.
- Keep conversation storage separate from model execution.
- Do not treat retrieved documents or tool output as trusted instructions.

### E. Tool engine
- Represent each tool with a schema, permission policy, and execution boundary.
- Validate tool arguments before execution.
- Require user confirmation for consequential external actions.
- Return tool results to the orchestrator as untrusted data.
- Keep an audit record of tool name, decision, and outcome without unnecessarily storing sensitive payloads.

### F. Safety and privacy
- Validate input and output.
- Prevent secrets from entering client bundles or logs.
- Add per-user and per-IP rate limits before public access.
- Set maximum request, context, and output sizes.
- Define retention and deletion behavior before cloud history is introduced.
- Do not use conversations for training unless a separate, informed opt-in process is designed and approved.

### G. Observability and evaluation
- Measure availability, latency, error rate, token/compute usage, and model version.
- Use synthetic or consented evaluation prompts.
- Track quality across a repeatable test set before changing the default model.
- Avoid logging full conversation text by default.

## 4. Model execution strategy

### Initial development
Implement and test the adapter contract with a mock adapter that is clearly marked as a test double and cannot be mistaken for a real AI response. Then evaluate an appropriately licensed, small open-weight model against actual available hardware.

### Runtime options to evaluate
- **llama.cpp / Ollama:** practical candidates for local development and smaller quantized models.
- **vLLM:** candidate for GPU-backed serving and higher-throughput deployments.
- **Transformers:** model loading, experimentation, evaluation, and fine-tuning ecosystem.

No runtime is selected for production yet. Selection depends on model compatibility, device memory, measured response quality, latency, licensing, and total operating cost.

### Model governance
For every candidate checkpoint, record:
- Publisher and exact model/version identifier.
- Licence and use restrictions.
- Intended use and known limitations.
- Hardware and memory requirements.
- Evaluation results and safety findings.
- Whether it is third-party open-weight or VXNCI-owned.

## 5. VXNCI model ownership stages

1. **Platform ownership:** VXNCI owns the application-facing API, router, orchestration, tools, and evaluation framework.
2. **Deployment ownership:** Operate a third-party open-weight model on infrastructure under our control, if affordable and technically practical.
3. **Adaptation ownership:** Fine-tune or adapt only when licence terms permit and data rights, consent, and compute are established.
4. **Model ownership:** Publish and maintain a VXNCI-owned checkpoint only after its origin, training/adaptation process, evaluations, and rights are documented.
5. **Foundation research:** Consider training from scratch only after a feasibility study establishes data, compute, expertise, funding, and a measurable reason to do so.

The name **VXNCI-1** is reserved for the first model that VXNCI has actually developed and can substantiate. It must not be used as a label for an unrelated third-party model.

## 6. Suggested code boundaries

```text
app/
  api/
    chat/
      route.ts
lib/
  ai/
    contracts.ts
    model-router.ts
    orchestration.ts
    safety.ts
    adapters/
      adapter-registry.ts
      local-runtime.ts
      external-api.ts       # optional, disabled unless approved
  tools/
    registry.ts
    permissions.ts
  chat/
    types.ts
    storage.ts
docs/
  BUILD_PLAN.md
  AI_CORE_ARCHITECTURE.md
```

These are proposed boundaries. Add files only when their behavior is implemented and tested; do not create empty modules merely to imply progress.

## 7. Implementation sequence

1. Verify the existing Next.js scaffold can build.
2. Define and test the model-neutral TypeScript contracts.
3. Implement server-side chat request validation and a clearly labelled test adapter.
4. Add conversation state and local persistence to the client.
5. Add safety, error handling, cancellation, and rate limits.
6. Benchmark open-weight candidates against available hardware and budget.
7. Implement one real runtime adapter only after model and deployment feasibility are established.
8. Evaluate before enabling tools, accounts, cloud memory, or public deployment.

## 8. Non-goals for the first milestone

- Training a foundation model from scratch.
- Claiming ChatGPT/Claude/Gemini-level capability without comparative evaluation.
- Activating paid APIs, hosted GPUs, or subscriptions without explicit approval.
- Storing private conversations as training data by default.
- Enabling autonomous external actions without permission checks and user confirmation.

## 9. Definition of done for the first AI Core milestone

The first milestone is complete only when:
- The model contract has automated tests.
- A server-side request reaches the selected adapter.
- A real model response can be distinguished from test responses.
- Credentials are not exposed to the browser or repository.
- Errors, timeouts, and cancellation are handled.
- The model identity and limitations are disclosed accurately.
- The application build and end-to-end chat test pass.
