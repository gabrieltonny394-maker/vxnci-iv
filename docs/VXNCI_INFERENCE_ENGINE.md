# VXNCI Intelligence — Inference Engine

## Purpose

The inference engine is the model-independent execution boundary between the VXNCI API/provider registry and a concrete model runtime. It validates a model manifest, constrains generation settings, forwards requests to an explicitly attached backend, and normalizes the response.

## Model manifest

A model manifest declares:
- format version
- model ID
- architecture identifier
- tokenizer identifier
- safe relative weights path
- context length
- maximum output token count

The current manifest is a typed contract. It does not imply that a weights file exists or has been loaded.

## Backend boundary

A concrete `InferenceBackend` must implement tokenization, model execution, and decoding, and return generated text plus finish/usage metadata. The engine does not generate placeholder responses. If no backend is attached, it reports that inference is unavailable.

## Current state

Implemented:
- typed manifest and inference request/response contracts
- manifest validation and safe relative weights-path checks
- backend/model identity checks
- request cancellation check and output-token limits
- model adapter bridge for the VXNCI provider registry
- automated tests using a controlled fake backend

Not implemented:
- VXNCI-1 model architecture implementation
- tokenizer implementation or vocabulary
- model weights or training dataset
- training/fine-tuning pipeline
- CPU/GPU tensor backend and optimized kernels
- loading real weights from disk
- production inference serving or deployment

The fake backend exists only in automated tests. It is not registered as a production provider and must never be described as VXNCI-1.

## Next engineering stages

1. Select and specify the first VXNCI-1 architecture and tokenizer.
2. Implement a local model artifact loader with integrity checks.
3. Choose a feasible CPU-first tensor execution path and benchmark its memory/runtime requirements.
4. Train or otherwise create VXNCI-1 weights using data with appropriate rights.
5. Run reproducible inference and quality/safety evaluations before registering the model in the API.
