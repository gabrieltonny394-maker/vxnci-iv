# VXNCI Intelligence API v1

## Endpoints

- `GET /api/v1/models` — authenticated catalogue of explicitly registered model adapters.
- `POST /api/v1/chat/completions` — authenticated non-streaming chat completion endpoint.

## Authentication

Send `Authorization: Bearer <api-key>`. The server compares the SHA-256 digest of the supplied key with `VXNCI_API_KEY_SHA256`. Only the digest belongs in the server environment; never commit a plaintext API key.

Generate a random key outside the repository, calculate its SHA-256 hex digest, and configure that digest as a server-only environment variable. Do not expose it through a `NEXT_PUBLIC_` variable.

This first milestone supports one operator-managed key. It does not yet provide key issuance, per-customer identities, rotation/revocation UI, quotas, billing, or usage persistence. Do not expose this endpoint publicly until those controls and deployment security are reviewed.

## Chat request

```json
{
  "model": "vxnci-model-id",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}
```

The current orchestration uses the server-configured `VXNCI_DEFAULT_MODEL`; model-specific selection is not enabled in this milestone. `stream: true` is rejected rather than silently ignored.

## Response

Successful responses use a chat-completion envelope with an assistant message. Errors use an `error` object and appropriate HTTP status codes:

- `400` invalid request
- `401` missing or invalid API key
- `503` no configured VXNCI model runtime
- `500` unexpected inference failure

## Current limitations

The API is a contract and authenticated server route, not proof of a live AI service. No inference adapter or VXNCI-1 model weights are currently registered. With no runtime configured, valid chat requests return `503`. There is no external-provider fallback, streaming, billing, rate limiting, customer key management, or hosted deployment in this milestone.
