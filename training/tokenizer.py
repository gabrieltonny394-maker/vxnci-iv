"""Small, dependency-free byte-level BPE tokenizer for VXNCI-1 Tiny.

This is a correctness-first reference implementation, not an optimized
large-corpus tokenizer. All Unicode text is representable through UTF-8 bytes.
"""
from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SPECIAL_TOKENS = ("<|endoftext|>", "<|pad|>", "<|user|>", "<|assistant|>")
BYTE_TOKEN_COUNT = 256
SPECIAL_START = BYTE_TOKEN_COUNT


@dataclass
class ByteBPETokenizer:
    token_bytes: list[bytes | None]
    merges: list[tuple[int, int]]

    @property
    def vocab_size(self) -> int:
        return len(self.token_bytes)

    @property
    def special_token_ids(self) -> dict[str, int]:
        return {token: SPECIAL_START + i for i, token in enumerate(SPECIAL_TOKENS)}

    def encode(self, text: str, *, add_eos: bool = False) -> list[int]:
        ids = list(text.encode("utf-8"))
        merge_ranks = {pair: BYTE_TOKEN_COUNT + len(SPECIAL_TOKENS) + i
                       for i, pair in enumerate(self.merges)}
        while len(ids) > 1:
            best_rank = None
            best_pair = None
            for pair in zip(ids, ids[1:]):
                rank = merge_ranks.get(pair)
                if rank is not None and (best_rank is None or rank < best_rank):
                    best_rank, best_pair = rank, pair
            if best_pair is None:
                break
            merged_id = best_rank
            merged: list[int] = []
            i = 0
            while i < len(ids):
                if i + 1 < len(ids) and (ids[i], ids[i + 1]) == best_pair:
                    merged.append(merged_id)
                    i += 2
                else:
                    merged.append(ids[i])
                    i += 1
            ids = merged
        if add_eos:
            ids.append(self.special_token_ids["<|endoftext|>"])
        return ids

    def decode(self, ids: Iterable[int], *, skip_special_tokens: bool = True) -> str:
        output = bytearray()
        for token_id in ids:
            if not isinstance(token_id, int) or token_id < 0 or token_id >= self.vocab_size:
                raise ValueError(f"Token ID out of range: {token_id!r}")
            piece = self.token_bytes[token_id]
            if piece is None:
                if skip_special_tokens:
                    continue
                raise ValueError("Special-token text decoding is not implemented")
            output.extend(piece)
        return output.decode("utf-8", errors="replace")

    def save(self, path: str | Path) -> None:
        payload = {
            "format": "vxnci-byte-bpe-v1",
            "special_tokens": list(SPECIAL_TOKENS),
            "token_bytes": [
                None if piece is None else base64.b64encode(piece).decode("ascii")
                for piece in self.token_bytes
            ],
            "merges": [list(pair) for pair in self.merges],
        }
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                              encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "ByteBPETokenizer":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        if payload.get("format") != "vxnci-byte-bpe-v1":
            raise ValueError("Unsupported tokenizer format")
        if tuple(payload.get("special_tokens", [])) != SPECIAL_TOKENS:
            raise ValueError("Special-token definitions do not match this implementation")
        pieces = [
            None if item is None else base64.b64decode(item, validate=True)
            for item in payload["token_bytes"]
        ]
        merges = [tuple(pair) for pair in payload["merges"]]
        if len(pieces) < BYTE_TOKEN_COUNT + len(SPECIAL_TOKENS):
            raise ValueError("Tokenizer vocabulary is incomplete")
        if any(len(pair) != 2 for pair in merges):
            raise ValueError("Invalid merge entry")
        return cls(token_bytes=pieces, merges=merges)


def train_byte_bpe(texts: Iterable[str], vocab_size: int = 8192,
                   min_pair_frequency: int = 2) -> ByteBPETokenizer:
    """Train BPE merges from text strings using deterministic frequency ties."""
    minimum_vocab = BYTE_TOKEN_COUNT + len(SPECIAL_TOKENS)
    if vocab_size < minimum_vocab:
        raise ValueError(f"vocab_size must be at least {minimum_vocab}")
    if min_pair_frequency < 1:
        raise ValueError("min_pair_frequency must be positive")

    sequences = [list(text.encode("utf-8")) for text in texts if text]
    token_bytes: list[bytes | None] = [bytes([i]) for i in range(BYTE_TOKEN_COUNT)]
    token_bytes.extend([None] * len(SPECIAL_TOKENS))
    merges: list[tuple[int, int]] = []

    while len(token_bytes) < vocab_size:
        counts: dict[tuple[int, int], int] = {}
        for sequence in sequences:
            for pair in zip(sequence, sequence[1:]):
                counts[pair] = counts.get(pair, 0) + 1
        if not counts:
            break
        best_pair, best_count = min(
            counts.items(), key=lambda item: (-item[1], item[0])
        )
        if best_count < min_pair_frequency:
            break

        left, right = best_pair
        new_id = len(token_bytes)
        token_bytes.append(token_bytes[left] + token_bytes[right])
        merges.append(best_pair)

        updated_sequences: list[list[int]] = []
        for sequence in sequences:
            merged: list[int] = []
            i = 0
            while i < len(sequence):
                if i + 1 < len(sequence) and (sequence[i], sequence[i + 1]) == best_pair:
                    merged.append(new_id)
                    i += 2
                else:
                    merged.append(sequence[i])
                    i += 1
            updated_sequences.append(merged)
        sequences = updated_sequences

    return ByteBPETokenizer(token_bytes=token_bytes, merges=merges)
