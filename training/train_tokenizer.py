"""Train and save the VXNCI-1 byte-level BPE tokenizer from JSONL text."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from training.tokenizer import train_byte_bpe


def load_training_texts(path: str | Path) -> list[str]:
    texts: list[str] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_number}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"Line {line_number} must contain a JSON object")
            text = record.get("text")
            source = record.get("source")
            license_name = record.get("license")
            split = record.get("split")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"Line {line_number} has no non-empty text")
            if not isinstance(source, str) or not source.strip():
                raise ValueError(f"Line {line_number} is missing source provenance")
            if not isinstance(license_name, str) or not license_name.strip():
                raise ValueError(f"Line {line_number} is missing license information")
            if split not in ("train", "validation"):
                raise ValueError(f"Line {line_number} split must be train or validation")
            if split == "train":
                texts.append(text)
    if not texts:
        raise ValueError("No training records found; validation records are not used")
    return texts


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the VXNCI-1 Tiny tokenizer")
    parser.add_argument("--input", required=True, help="UTF-8 JSONL corpus")
    parser.add_argument("--output", default="artifacts/vxnci-1-tiny/tokenizer.json")
    parser.add_argument("--vocab-size", type=int, default=8192)
    parser.add_argument("--min-pair-frequency", type=int, default=2)
    args = parser.parse_args()

    texts = load_training_texts(args.input)
    tokenizer = train_byte_bpe(
        texts, vocab_size=args.vocab_size,
        min_pair_frequency=args.min_pair_frequency,
    )
    tokenizer.save(args.output)
    print(f"Saved {tokenizer.vocab_size} tokenizer entries to {args.output}")


if __name__ == "__main__":
    main()
