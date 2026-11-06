# VXNCI-1 Architecture

**Status:** Architecture specification only. No model weights have been trained or created.

## 1. Purpose

VXNCI-1 is the first model in the VXNCI Intelligence model family. The first milestone is a small, reproducible language model that can be trained and evaluated locally. It is a foundation and learning milestone, not a claim of ChatGPT-level capability.

The initial implementation is named **VXNCI-1 Tiny** (`vxnci-1-tiny`). The name does not imply that a trained model currently exists.

## 2. Architecture decision

Use a decoder-only Transformer with causal self-attention:

- RMSNorm for normalization.
- Rotary positional embeddings (RoPE).
- Causal multi-head self-attention.
- SwiGLU feed-forward blocks.
- Tied token embedding and output projection weights.
- No linear-layer biases in the Transformer blocks.

This is a compact, well-understood design that supports autoregressive next-token training and can later be connected to the existing VXNCI inference-engine contract.

## 3. Initial configuration

| Setting | Initial value |
|---|---:|
| Vocabulary | 8,192 tokens |
| Hidden size | 256 |
| Transformer layers | 6 |
| Attention heads | 8 |
| Key/value heads | 8 |
| Feed-forward width | 1,024 |
| Context length | 512 tokens |
| Maximum generated tokens | 256 |
| Embeddings/output head | Tied |
| Normalization | RMSNorm |
| Position encoding | RoPE |

The approximate parameter count is **8.39 million**, assuming the specified dimensions, tied embeddings and no biases. Exact count will be confirmed by the implemented model before training.

Approximate parameter storage:
- FP32 weights: about 32 MiB (33.6 MB decimal).
- BF16/FP16 weights: about 16 MiB (16.8 MB decimal).

These are weights-only estimates. Training also needs gradients, optimizer state, activations, batches and checkpoint memory; actual RAM requirements will be substantially higher and depend on batch size and implementation. CPU-first means we avoid requiring a paid GPU service; it does not guarantee fast training on every computer.

## 4. Tokenizer

Start with byte-level Byte Pair Encoding (BPE), vocabulary size 8,192, with UTF-8 byte fallback.

Reasons:
- Any Unicode input can be represented, including English, Kiswahili and mixed-language text.
- BPE learns frequent character and word fragments, reducing sequence length compared with raw bytes.
- Byte fallback avoids unknown-character failures.

The tokenizer must be trained on the approved training corpus and versioned with the model. Special tokens (beginning/end of sequence, padding and any future chat markers) must have documented IDs and be tested for round-trip behavior.

## 5. Training approach

- Initialize model weights randomly.
- Train next-token prediction on legally usable, documented text.
- Use PyTorch as the local tensor/training framework; it is not an AI provider and does not supply model intelligence or pretrained weights.
- Begin with small batches and short context during smoke tests, then scale only after measuring available RAM and throughput.
- Use AdamW, learning-rate warmup followed by cosine decay, gradient clipping, and periodic checkpoints.
- Track training loss and validation loss separately. Keep a held-out validation split.
- Save model weights and tokenizer artifacts together with a manifest, dataset provenance, configuration and training metadata.

No third-party hosted model or external AI API is part of this training plan. Any dataset must be reviewed for licensing and provenance before use. No dataset download, paid resource, cloud GPU, or hosted deployment is authorized by this architecture document.

## 6. Data format

The initial corpus pipeline should accept UTF-8 JSONL records with at least:
- `text`: training text.
- `source`: human-readable source identifier.
- `license`: license or usage basis.
- `split`: train or validation.

Records without known provenance or a usable license must be excluded. Personal or confidential data must not be added. Deduplication and quality filtering are required before tokenizer training.

## 7. Resource and capability expectations

This model is intentionally tiny. It is suitable for proving tokenizer training, model training, checkpointing, local inference and evaluation. It is not expected to provide broad factual knowledge, reliable reasoning, or competitive assistant quality without substantial high-quality data and compute.

The parameter-file estimate is not a full RAM estimate. Before any full training run, benchmark a tiny synthetic batch and measure peak memory on the actual machine. Do not assume a phone or an unknown desktop can train this configuration efficiently.

## 8. Integration boundary

The model will eventually implement the existing VXNCI inference backend interface. The provider registry and API must report the model as unavailable until valid weights, tokenizer files and a working local backend are loaded. No placeholder responses and no silent external fallback.

## 9. Milestones

1. Architecture and configuration — this document and `config.json`.
2. Tokenizer implementation and tests.
3. Model implementation with shape, parameter-count and causal-mask tests.
4. Synthetic-data training smoke test.
5. Approved corpus preparation and provenance checks.
6. Training, validation and checkpoint integrity.
7. Local inference backend connected to the VXNCI inference engine.
8. Evaluation and model-card documentation before any public claims.

## 10. Explicit non-claims

At this stage:
- VXNCI-1 has not been trained.
- There are no model weights or tokenizer artifacts.
- There is no active inference runtime for VXNCI-1.
- No measured training speed, RAM requirement, benchmark score or assistant-quality claim exists.
- No external provider fallback is enabled.
