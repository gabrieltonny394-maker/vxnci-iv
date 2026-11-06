# VXNCI Intelligence — Provider Core

**Status:** Initial provider registry implemented; no inference provider is active.  
**Owner:** VXNCI Intelligence  
**Parent company:** LUXORA CLUB  
**First assistant:** VX NCI IV  
**Reserved first VXNCI-owned model:** VXNCI-1

## Purpose

VXNCI Intelligence is intended to become an independently operated AI provider platform. Its provider layer will own the model-facing API, provider and model catalogue, request routing, inference lifecycle, security controls, usage accounting, and operational observability.

The provider platform and the AI model are separate assets:

- **Provider platform:** the software and infrastructure that accepts requests and serves models.
- **Model:** the learned parameters and associated tokenizer/configuration that produce model outputs.
- **Assistant product:** the user-facing application that uses the provider platform.

The existence of provider software does not mean a proprietary foundation model has been trained.

## First implementation boundary

The initial Provider Core provides:

- A typed registration contract for provider identity and provider kind.
- A server-side registry for explicitly registered model adapters.
- Validation that provider identity matches the adapter identity.
- Duplicate provider and model protection.
- Model lookup and a safe provider summary catalogue.
- No automatic fallback to a different provider or model.

Provider kinds are classified as `local`, `self-hosted`, `external`, or `test`. Classification does not activate a provider or grant permission to use a paid service.

## Current limitations

- No inference runtime is installed or configured.
- No external AI provider SDK or API is connected.
- No provider is registered by default.
- No model weights are included.
- No VXNCI-1 training has started.
- No public provider API, API-key issuance, billing, or multi-tenant isolation is implemented.

A request for an unconfigured model must continue to fail clearly. The platform must never fabricate a response or silently route to a third-party service.

## Target architecture

```text
VX NCI IV and future clients
            |
            v
     VXNCI Provider API
  authentication / quotas / validation
            |
            v
       VXNCI AI Core
  context / safety / orchestration
            |
            v
      Provider Registry
       model routing
            |
            v
     Provider Adapter API
       /           \
      v             v
VXNCI-owned      Other explicitly
inference        approved runtimes
      |
      v
   VXNCI-1
 (future model)
```

## Development sequence

1. Establish and test the provider registration and routing contracts.
2. Add automated tests for registration, duplicate prevention, lookup, and empty-registry behavior.
3. Design a versioned, authenticated provider API before exposing it publicly.
4. Specify model artifact formats, tokenizer compatibility, request limits, streaming, cancellation, and health checks.
5. Evaluate available local hardware and runtime options before choosing an inference engine.
6. Build a model-serving adapter only after its hardware and licensing requirements are understood.
7. Design the VXNCI-1 data, tokenizer, architecture, training, evaluation, and model-governance pipeline.
8. Add production controls such as tenant isolation, rate limits, abuse prevention, observability, and usage metering before public access.

## Operating rules

- No paid API, hosted GPU, subscription, or deployment is enabled without explicit approval.
- No external provider is used as a silent fallback.
- Third-party model weights must retain accurate attribution and licence compliance.
- VXNCI-1 is reserved for a model whose development and ownership can be substantiated.
- User conversations are not training data by default.
- Never describe an architecture document or registry as a running inference service.
