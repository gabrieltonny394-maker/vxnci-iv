# LUXORA Core Benchmark Harness

The first executable benchmark runner evaluates a **trained checkpoint** using held-out validation text. It reports next-token negative log likelihood, perplexity, forward-pass latency, token throughput, and peak CUDA memory when applicable.

## Important scope boundary

The current repository model is an architecture prototype. Its checked-in configuration is marked `architecture-only` and initializes weights randomly; there is no trained LUXORA Core checkpoint or validated production inference/generation adapter yet. Therefore, this harness does not claim assistant quality, reasoning, coding, retrieval, or multimodal performance.

The benchmark runner intentionally reports those task families under `not_evaluated`. Task-success benchmarks will be added when a real generation interface and licensed, curated evaluation datasets are available.

## Input corpus

Use UTF-8 JSONL records with provenance and explicit splits. Each line must include non-empty `text`, `source`, and `license`, and `split` must be `train` or `validation`. The harness evaluates only validation records. Keep benchmark/holdout content out of training and tokenizer fitting.

Example record:

```json
{"text":"A short validation passage.","source":"locally-authored","license":"original","split":"validation"}
```

The tokenizer must be trained from training data only and its vocabulary must fit the model configuration.

## Run

Install the repository's training requirements, then run:

```bash
python -m pip install -r requirements-training.txt
python -m training.benchmark \
  --config model/vxnci-1-tiny/config.json \
  --checkpoint path/to/model.safetensors \
  --tokenizer path/to/tokenizer.json \
  --data path/to/provenance-corpus.jsonl \
  --output artifacts/benchmark-report.json \
  --device cpu
```

Use `--device cuda` only when CUDA is available and its compute use is approved. The command does not download a model, dataset, or external service.

The JSON report records model/config/checkpoint/tokenizer/corpus SHA-256 hashes, environment details, validation sample counts, quality metrics, latency, throughput, and memory. Preserve reports across model revisions for fair comparison.

## Unit tests

```bash
python -m unittest discover -s tests -p 'test_benchmark.py' -v
```

These tests validate metric calculations and the harness using a tiny randomly initialized model. They validate the benchmark software, **not** the quality of a trained model.
