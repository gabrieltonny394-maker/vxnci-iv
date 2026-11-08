"""Provenance-checked JSONL loading and fixed-length token blocks."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import Dataset

from training.tokenizer import ByteBPETokenizer


def load_corpus_records(path: str | Path) -> tuple[list[str], list[str]]:
    """Return train and validation texts; reject records without provenance."""
    train_texts: list[str] = []
    validation_texts: list[str] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record: Any = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_number}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"Line {line_number} must be a JSON object")
            text = record.get("text")
            source = record.get("source")
            license_name = record.get("license")
            split = record.get("split")
            rights_status = record.get("rights_status", "approved")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"Line {line_number} needs non-empty text")
            if not isinstance(source, str) or not source.strip():
                raise ValueError(f"Line {line_number} is missing source provenance")
            if not isinstance(license_name, str) or not license_name.strip():
                raise ValueError(f"Line {line_number} is missing license information")
            if split not in ("train", "validation", "held_out", "safety"):
                raise ValueError(f"Line {line_number} has an unsupported dataset split")
            if rights_status not in ("approved", "quarantined"):
                raise ValueError(f"Line {line_number} has an invalid rights_status")
            # Never feed quarantined, held-out, or safety records to model training.
            if rights_status != "approved":
                continue
            if split == "train":
                train_texts.append(text)
            elif split == "validation":
                validation_texts.append(text)
    if not train_texts:
        raise ValueError("Corpus contains no training records")
    if not validation_texts:
        raise ValueError("Corpus contains no validation records")
    return train_texts, validation_texts


class TokenBlockDataset(Dataset[dict[str, torch.Tensor]]):
    """Encode documents independently and produce padded causal-LM blocks."""

    def __init__(
        self,
        texts: list[str],
        tokenizer: ByteBPETokenizer,
        context_length: int,
        model_vocab_size: int,
    ) -> None:
        if context_length < 2:
            raise ValueError("context_length must be at least 2")
        if tokenizer.vocab_size > model_vocab_size:
            raise ValueError("Tokenizer vocabulary exceeds model vocabulary")
        self.examples: list[dict[str, torch.Tensor]] = []
        pad_id = tokenizer.special_token_ids["<|pad|>"]
        for text in texts:
            token_ids = tokenizer.encode(text, add_eos=True)
            for start in range(0, len(token_ids), context_length):
                block = token_ids[start : start + context_length]
                if len(block) < 2:
                    continue
                valid_length = len(block)
                input_ids = block + [pad_id] * (context_length - valid_length)
                labels = block + [-100] * (context_length - valid_length)
                self.examples.append({
                    "input_ids": torch.tensor(input_ids, dtype=torch.long),
                    "labels": torch.tensor(labels, dtype=torch.long),
                })
        if not self.examples:
            raise ValueError("No usable token blocks; corpus text may be too short")

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        return self.examples[index]
