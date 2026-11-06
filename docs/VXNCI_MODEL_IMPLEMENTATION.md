# VXNCI-1 Tiny Model Implementation

**Status:** Architecture code implemented; weights are still untrained and absent.

## Implemented

- Configuration loader aligned with `model/vxnci-1-tiny/config.json`.
- RMSNorm.
- Rotary positional embeddings (RoPE).
- Causal multi-head self-attention using PyTorch scaled dot-product attention.
- SwiGLU feed-forward network.
- Pre-normalized decoder Transformer blocks with residual connections.
- Tied token embedding and language-model output weights.
- Next-token cross-entropy loss with shifted labels and padding ignore index `-100`.
- Input shape, context length and token-range validation.

## Local setup

Install the training dependency in a Python environment:

```bash
python -m pip install -r requirements-training.txt
```

Run model tests:

```bash
python -m unittest discover -s tests -p 'test_model.py' -v
```

The PyTorch package is a local open-source tensor framework, not an AI provider. This implementation does not call OpenAI, Anthropic, Google or another inference API.

## Current limits

- Model parameters are randomly initialized.
- No training corpus has been approved or loaded.
- No trained checkpoint, tokenizer artifact or inference backend exists yet.
- This code does not provide a chat-quality assistant by itself.
- CPU-first describes the intended local path, not a promise that training will be fast or fit on every device.
- Do not start a full training run until memory and throughput have been measured on the actual machine and the dataset's licensing/provenance has been reviewed.
