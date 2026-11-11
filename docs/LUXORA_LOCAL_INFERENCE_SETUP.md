# LUXORA AI local inference setup

This guide connects the Next.js chat API to the local PyTorch runtime for
`vxnci-1-tiny`. It does not turn an untrained checkpoint into a capable
assistant. The runtime refuses to start without model weights, a tokenizer,
and training metadata from a dataset that passed provenance validation.

## Current prerequisites

- A computer capable of running Python 3.10+ and Node.js 20.9+.
- The repository checked out on `develop/vxnci-foundation`.
- An approved JSONL training corpus with documented rights and provenance.
- Free local disk space for Python packages, tokenizer, checkpoint and logs.
- No external model API, paid GPU, hosted inference provider, or deployment is
  required for this local setup.

An Android phone alone is not a practical environment for this PyTorch training
pipeline. Do not try to train the 8.39-million-parameter model on the phone.

## 1. Prepare an approved dataset

The dataset registry requires one JSON object per line with these fields:

- `record_id`: unique stable record identifier.
- `text`: the text the model may learn from.
- `source`: where the text came from.
- `license`: the applicable licence or documented permission.
- `rights_status`: `approved` or `quarantined`.
- `content_type`: `original`, `licensed`, `public_domain`, or `synthetic`.
- `contributor`: who supplied or created the record.
- `created_at`: ISO-8601 timestamp.
- `split`: `train`, `validation`, `held_out`, or `safety`.
- `generation_method`: additionally required for synthetic records.

Only approved train and validation records are used by the tokenizer/training
pipeline. Held-out and safety records are not trained on. Quarantined records
are excluded. Never copy books, websites, private conversations, customer data,
or other material into the corpus unless LUXORA has the necessary rights and
permission. Do not invent source or licence details.

Example shape only (replace every placeholder with verified information; this
is not a training sample):

```json
{"record_id":"replace-with-unique-id","text":"replace-with-authorized-text","source":"documented-source","license":"documented-license-or-permission","rights_status":"approved","content_type":"original","contributor":"documented-contributor","created_at":"2026-11-11T00:00:00Z","split":"train"}
```

Include both approved `train` and `validation` records. Keep near-duplicate
content out of different splits. The registry rejects normalized duplicates.

## 2. Install the local training dependencies

From the repository root:

```bash
python -m venv .venv
```

Activate the environment, then install:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements-training.txt
```

## 3. Validate data and train the tokenizer

```bash
python -m training.dataset_registry --data path/to/approved-corpus.jsonl
python -m training.train_tokenizer --input path/to/approved-corpus.jsonl --output artifacts/vxnci-1-tiny/tokenizer.json
```

The tokenizer is trained only from approved training-split text. Validation text
is not used to learn tokenizer merges.

## 4. Train and save a checkpoint

Start with a short, low-cost local experiment; this is a smoke run, not a
release-quality training recipe:

```bash
python -m training.train --data path/to/approved-corpus.jsonl --tokenizer artifacts/vxnci-1-tiny/tokenizer.json --output-dir artifacts/vxnci-1-tiny/checkpoint --epochs 1 --max-steps 10 --batch-size 1 --device cpu
```

The resulting directory must contain:

- `model.safetensors`
- `training_state.json`

The training state records the completed steps, validation loss and dataset
validation report. A ten-step smoke run is not evidence of useful language
quality and must not be marketed as a capable LUXORA model. Increase training
only after measuring quality, resource use and data rights.

## 5. Start the local inference service

Set a long, private bearer token in the shell environment as
`LUXORA_INFERENCE_TOKEN`, then run:

```bash
python -m training.serve --config model/vxnci-1-tiny/config.json --tokenizer artifacts/vxnci-1-tiny/tokenizer.json --checkpoint artifacts/vxnci-1-tiny/checkpoint/model.safetensors --training-state artifacts/vxnci-1-tiny/checkpoint/training_state.json
```

The service binds to `127.0.0.1:8091` by default. Its health endpoint is
`GET /health`; generation is authenticated at `POST /v1/generate`. Do not
expose this development server to the public internet.

## 6. Connect the Next.js server

Set these server-side environment variables for the Next.js process:

- `LUXORA_INFERENCE_URL=http://127.0.0.1:8091`
- `LUXORA_INFERENCE_TOKEN`: the same secret used by the Python service.
- `LUXORA_MODEL_ID=vxnci-1-tiny`

Then start Next.js on the same computer/network namespace as the inference
service. The API checks the inference service health and exact model ID before
registering it. If the backend is offline, the model is not advertised and chat
returns the existing unavailable-runtime response.

A hosted Next.js deployment cannot reach a user's private `127.0.0.1`. A
remote deployment would require a separately secured private network/runtime
and an explicit deployment decision; this guide does not configure one.

## What counts as operational

A successful Python test or a successful Next.js build verifies code paths,
not model quality. Before calling LUXORA Core operational, verify all of these:

1. A real, rights-approved dataset passes validation.
2. Tokenizer training completes from the training split.
3. Model training produces a checkpoint and finite validation loss.
4. The Python service loads that exact checkpoint and tokenizer.
5. The Next.js API registers only the healthy matching model.
6. Real chat requests complete through the loaded model.
7. Held-out task, safety, instruction-following and text-fidelity evaluations
   meet a defined release threshold.

Until these gates pass, `vxnci-1-tiny` remains experimental and LUXORA Core
must not be advertised as a working model.
