# VXNCI-1 Tokenizer

**Status:** First local reference implementation. No production corpus or trained model is included.

## Design

VXNCI-1 Tiny uses byte-level Byte Pair Encoding (BPE):
- Every UTF-8 byte (0–255) is always representable.
- Four reserved IDs are allocated after the byte tokens: end-of-text, padding, user and assistant.
- Learned merges are appended in training order.
- Unknown Unicode characters do not require an unknown-token marker because encoding falls back to UTF-8 bytes.

This is a correctness-first implementation using Python's standard library. It is intentionally simple and is not optimized for large corpora.

## Corpus format

Input is UTF-8 JSON Lines (one JSON object per line):

\`\`\`json
{"text":"Example training text.","source":"source-name","license":"CC0-1.0","split":"train"}
{"text":"Held-out example.","source":"source-name","license":"CC0-1.0","split":"validation"}
\`\`\`

Every record must include non-empty \`text\`, \`source\`, and \`license\`, and a \`split\` of \`train\` or \`validation\`. Only \`train\` records are used to learn merges. Validation text is excluded from tokenizer training.

The fields are provenance declarations, not automatic legal verification. A human must confirm that each source and license actually permits the intended use. Do not include confidential or personal data.

## Run locally

From the repository root with Python 3.10 or newer:

\`\`\`bash
python -m unittest tests.test_tokenizer
python -m training.train_tokenizer --input path/to/approved-corpus.jsonl --output artifacts/vxnci-1-tiny/tokenizer.json --vocab-size 8192
\`\`\`

The tokenizer trainer does not download data, call an external service, or require a paid dependency.

## Current limitations

- Pair counting and sequence rewriting are deliberately straightforward and can be slow on large corpora.
- There is no pre-tokenization or Unicode normalization; the exact UTF-8 byte stream is preserved.
- The tokenizer is not yet integrated into model training or the inference engine.
- A saved tokenizer is not a trained language model.
