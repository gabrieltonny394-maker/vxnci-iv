# VXNCI-1 Tiny Training Pipeline

**Status:** Training code is implemented. No corpus has been supplied, no training run has been performed, and no trained checkpoint exists.

## Data requirements

The trainer requires UTF-8 JSONL with one JSON object per line:

```json
{"text":"A text sample written or licensed for this project.","source":"author-created","license":"original","split":"train"}
{"text":"A held-out evaluation sample.","source":"author-created","license":"original","split":"validation"}
```

Every record must have non-empty text, source, license and a split of `train` or `validation`. Both splits are mandatory. The pipeline rejects missing provenance and never uses validation text to train the tokenizer or model.

Only material that is legally usable for this project should be included. Do not include personal, confidential, scraped or unlicensed material. Keep a separate record of dataset permissions and origin.

## Local setup

Install dependencies:

```bash
python -m pip install -r requirements-training.txt
```

Train a tokenizer using the existing tokenizer utility:

```bash
python -m training.train_tokenizer --input data/corpus.jsonl --output artifacts/vxnci-1-tiny/tokenizer.json
```

Run a small CPU training experiment:

```bash
python -m training.train --data data/corpus.jsonl --tokenizer artifacts/vxnci-1-tiny/tokenizer.json --output-dir artifacts/vxnci-1-tiny/checkpoint --device cpu --batch-size 1 --epochs 1 --max-steps 10
```

The command above is an example smoke-test invocation, not a claim that the model has been trained. Use a small, reviewed dataset first and inspect available memory and runtime before increasing sequence length, batch size or steps.

## Training behavior

- Decoder-only next-token prediction with shifted cross-entropy labels.
- Documents are tokenized independently; training blocks do not cross document boundaries.
- Padding labels are masked with `-100`.
- AdamW optimizer, linear warmup followed by cosine learning-rate decay.
- Gradient clipping at 1.0.
- Validation loss is measured separately after training.
- Default device is CPU. CUDA must be explicitly requested and available.
- A deterministic seed is recorded.

## Checkpoint output

The output directory receives:
- `model.safetensors` — model weights.
- `optimizer_state.pt` — optimizer state for local training continuity.
- `training_state.json` — model/config/data paths, step count, validation loss and run metadata.

Treat optimizer state as a trusted local artifact; only load it from a source you control. The model weights use Safetensors.

## Explicit limitations

This pipeline does not download data, pay for compute, upload data, deploy a service or contact any external AI provider. It does not resume an interrupted run yet. A tokenizer must be trained first and its vocabulary must fit the model vocabulary. No model quality claim should be made until a documented corpus has been used and independent evaluations have been run.
