# VXNCI-1 Tiny model implementation

**Status:** Executable architecture implementation; not trained and not yet loadable by the production inference runtime.

## Implemented

The PyTorch reference model in `training/model.py` follows `model/vxnci-1-tiny/config.json`:

- Decoder-only Transformer with configurable blocks.
- RMSNorm, rotary positional embeddings (RoPE), causal multi-head self-attention and grouped-query support.
- SwiGLU feed-forward network.
- Tied token embedding and output projection weights.
- Next-token cross-entropy loss with the one-token shift.
- Input validation for token IDs, tensor shapes and context length.

It uses PyTorch scaled dot-product attention and supports CPU execution. It makes no network calls and uses no external AI provider.

## Install and test

Use Python 3.10+:

```bash
python -m pip install -r requirements-training.txt
python -m unittest discover -s tests -p 'test_model.py' -v
python -m unittest discover -s tests -p 'test_tokenizer.py' -v
```

## Limitations

- The model starts with random weights and cannot yet provide useful language responses.
- No dataset is included or downloaded. Training data must be reviewed for licensing, consent, privacy and quality.
- No checkpoint writer/loader, training loop, evaluation suite, quantization or production serving integration exists yet.
- Unit tests check implementation behavior, not model quality.
- The 8.39-million-parameter estimate describes weights only, not total training memory.
