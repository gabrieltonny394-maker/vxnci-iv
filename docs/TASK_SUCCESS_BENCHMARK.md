# Task-success benchmark

The next-token benchmark measures language-model loss and runtime. This layer
adds deterministic, generation-based task checks so the project can start
measuring answer success across labelled categories.

## Run

```bash
python -m training.task_benchmark \
  --config model/vxnci-1-tiny/config.json \
  --checkpoint path/to/model.safetensors \
  --tokenizer path/to/tokenizer.json \
  --tasks benchmarks/core-tasks.jsonl \
  --output artifacts/task-benchmark-report.json \
  --device cpu
```

Each JSONL task row contains:

- `id`: unique task identifier
- `category`: e.g. conversation, instruction_following, reasoning, mathematics, coding, retrieval
- `prompt`: prompt passed to the model
- `expected`: expected string or regular expression
- `evaluator`: `exact`, `contains`, or `regex`
- `max_new_tokens`: optional positive output limit

The runner reports overall and per-category pass rates, with each prediction
included for audit. Use original, licensed, held-out task data and version the
dataset alongside benchmark reports.

## Important limits

- The current model uses greedy decoding and recomputes the full prefix for
  every generated token. There is no KV cache or production serving optimization.
- Prompt plus requested output must fit the configured context length. The
  current tiny config is 512 tokens; this is not a 100k/200k context test.
- Deterministic string checks are useful for exact answers and constrained
  tasks, but they do not grade nuanced conversation, reasoning quality, or
  real-world code correctness. Add expert rubrics/human review for those.
- A random/untrained checkpoint can run the harness but its scores are not
  evidence of useful model capability. The repository currently has no trained
  LUXORA Core checkpoint.
- The harness does not claim long-context retrieval, multimodal, or cache
  savings capability. Those require separate datasets and implementation.

This is an evaluation tool, not a claim that any target capability has been
achieved.
