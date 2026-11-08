"""Reproducible evaluation and runtime benchmark for a trained Core checkpoint.

This harness measures held-out next-token quality and forward-pass performance.
It does not claim instruction-following, reasoning, retrieval, or chat quality:
those require a generation-capable inference adapter and curated task datasets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import statistics
import time
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader

from training.data import TokenBlockDataset, load_corpus_records
from training.model import VxnciForCausalLM, load_model_config
from training.tokenizer import ByteBPETokenizer


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        raise ValueError("Cannot calculate a percentile from no measurements")
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(quantile * len(ordered)) - 1))
    return ordered[index]


@torch.inference_mode()
def benchmark_model(
    model: VxnciForCausalLM,
    loader: DataLoader,
    *,
    device: torch.device,
    warmup_batches: int = 1,
) -> dict[str, Any]:
    if warmup_batches < 0:
        raise ValueError("warmup_batches cannot be negative")
    if len(loader) == 0:
        raise ValueError("Benchmark dataset is empty")

    model.to(device)
    model.eval()
    if device.type == "cuda":
        torch.cuda.reset_peak_memory_stats(device)

    batch_latencies: list[float] = []
    total_nll = 0.0
    total_scored_tokens = 0
    total_input_tokens = 0
    max_sequence_length = 0
    measured_batches = 0

    for batch_index, batch in enumerate(loader):
        input_ids = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)
        if device.type == "cuda":
            torch.cuda.synchronize(device)
        started = time.perf_counter()
        output = model(input_ids, labels=labels)
        if device.type == "cuda":
            torch.cuda.synchronize(device)
        elapsed = time.perf_counter() - started

        if batch_index < warmup_batches:
            continue

        loss = output.get("loss")
        if loss is None or not torch.isfinite(loss):
            raise RuntimeError("Benchmark encountered a missing or non-finite loss")

        # The model shifts labels internally; count only non-masked target positions.
        scored = int((labels[:, 1:] != -100).sum().item())
        if scored == 0:
            raise ValueError("Benchmark batch contains no scored target tokens")
        total_nll += float(loss.item()) * scored
        total_scored_tokens += scored
        total_input_tokens += int(input_ids.numel())
        max_sequence_length = max(max_sequence_length, int(input_ids.shape[1]))
        batch_latencies.append(elapsed)
        measured_batches += 1

    if measured_batches == 0 or total_scored_tokens == 0:
        raise ValueError("No benchmark batches remained after warmup")

    mean_nll = total_nll / total_scored_tokens
    try:
        perplexity = math.exp(mean_nll)
    except OverflowError:
        perplexity = None

    elapsed_total = sum(batch_latencies)
    return {
        "batches_measured": measured_batches,
        "warmup_batches": min(warmup_batches, len(loader)),
        "scored_tokens": total_scored_tokens,
        "input_tokens": total_input_tokens,
        "max_sequence_length": max_sequence_length,
        "mean_negative_log_likelihood": mean_nll,
        "perplexity": perplexity,
        "batch_latency_seconds": {
            "p50": statistics.median(batch_latencies),
            "p95": percentile(batch_latencies, 0.95),
        },
        "throughput": {
            "input_tokens_per_second": (
                total_input_tokens / elapsed_total if elapsed_total > 0 else None
            ),
            "scored_tokens_per_second": (
                total_scored_tokens / elapsed_total if elapsed_total > 0 else None
            ),
        },
        "peak_cuda_memory_bytes": (
            torch.cuda.max_memory_allocated(device) if device.type == "cuda" else None
        ),
    }


def run_benchmark(
    *,
    config_path: str | Path,
    checkpoint_path: str | Path,
    tokenizer_path: str | Path,
    corpus_path: str | Path,
    output_path: str | Path,
    batch_size: int = 1,
    device_name: str = "cpu",
    warmup_batches: int = 1,
) -> dict[str, Any]:
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")
    if device_name == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA requested but unavailable")
    device = torch.device(device_name)

    config = load_model_config(config_path)
    tokenizer = ByteBPETokenizer.load(tokenizer_path)
    _, validation_texts = load_corpus_records(corpus_path)
    dataset = TokenBlockDataset(
        validation_texts, tokenizer, config.context_length, config.vocab_size
    )
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

    from safetensors.torch import load_file

    model = VxnciForCausalLM(config)
    state = load_file(str(checkpoint_path), device=str(device))
    model.load_state_dict(state, strict=True)

    measurements = benchmark_model(
        model, loader, device=device, warmup_batches=warmup_batches
    )
    report: dict[str, Any] = {
        "schema_version": "1.0",
        "benchmark_kind": "held-out-next-token-and-runtime",
        "capability_scope": [
            "held-out next-token negative log likelihood",
            "perplexity",
            "forward-pass latency",
            "token throughput",
            "peak CUDA memory when applicable",
        ],
        "not_evaluated": [
            "instruction following",
            "multi-turn conversation quality",
            "reasoning",
            "mathematics task accuracy",
            "coding task success",
            "needle-in-a-haystack retrieval",
            "multimodal understanding",
            "cache savings",
        ],
        "model": {
            "model_id": config.model_id,
            "parameter_count": model.parameter_count(),
            "context_length": config.context_length,
            "config_sha256": sha256_file(config_path),
            "checkpoint_sha256": sha256_file(checkpoint_path),
            "tokenizer_sha256": sha256_file(tokenizer_path),
        },
        "dataset": {
            "validation_documents": len(validation_texts),
            "validation_token_blocks": len(dataset),
            "corpus_sha256": sha256_file(corpus_path),
            "split_used": "validation",
        },
        "environment": {
            "python": platform.python_version(),
            "pytorch": torch.__version__,
            "platform": platform.platform(),
            "device": str(device),
            "device_name": (
                torch.cuda.get_device_name(device) if device.type == "cuda" else platform.processor() or "CPU"
            ),
            "batch_size": batch_size,
        },
        "measurements": measurements,
    }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark a trained LUXORA Core-compatible causal-LM checkpoint"
    )
    parser.add_argument("--config", default="model/vxnci-1-tiny/config.json")
    parser.add_argument("--checkpoint", required=True, help="Safetensors model checkpoint")
    parser.add_argument("--tokenizer", required=True, help="Tokenizer JSON")
    parser.add_argument("--data", required=True, help="Provenance-documented JSONL corpus")
    parser.add_argument("--output", default="artifacts/benchmark-report.json")
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--warmup-batches", type=int, default=1)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()

    try:
        report = run_benchmark(
            config_path=args.config,
            checkpoint_path=args.checkpoint,
            tokenizer_path=args.tokenizer,
            corpus_path=args.data,
            output_path=args.output,
            batch_size=args.batch_size,
            device_name=args.device,
            warmup_batches=args.warmup_batches,
        )
    except (ValueError, OSError, RuntimeError, KeyError) as exc:
        parser.error(str(exc))
    print(json.dumps({
        "report": args.output,
        "model_id": report["model"]["model_id"],
        "scored_tokens": report["measurements"]["scored_tokens"],
        "perplexity": report["measurements"]["perplexity"],
        "latency_seconds": report["measurements"]["batch_latency_seconds"],
    }, indent=2))


if __name__ == "__main__":
    main()
