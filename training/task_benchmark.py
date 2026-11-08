"""Task-success benchmark for generation-capable LUXORA Core checkpoints.

Task files are JSONL. Each row has id, category, prompt, expected, evaluator
(exact|contains|regex), and optional max_new_tokens. This is a transparent,
deterministic baseline; it does not replace human/rubric evaluation.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Protocol

import torch

from training.model import VxnciForCausalLM, load_model_config
from training.tokenizer import ByteBPETokenizer


class GenerationAdapter(Protocol):
    def generate(self, prompt: str, *, max_new_tokens: int) -> str: ...


class TinyCheckpointAdapter:
    """Adapter for the repository's own PyTorch causal-LM implementation."""

    def __init__(self, model: VxnciForCausalLM, tokenizer: ByteBPETokenizer,
                 device: torch.device) -> None:
        self.model = model.to(device).eval()
        self.tokenizer = tokenizer
        self.device = device
        self.eos_token_id = tokenizer.special_token_ids["<|endoftext|>"]

    @torch.inference_mode()
    def generate(self, prompt: str, *, max_new_tokens: int) -> str:
        prompt_ids = self.tokenizer.encode(prompt)
        if not prompt_ids:
            raise ValueError("Task prompt must encode to at least one token")
        ids = torch.tensor([prompt_ids], dtype=torch.long, device=self.device)
        generated = self.model.generate(
            ids, max_new_tokens=max_new_tokens, eos_token_id=self.eos_token_id
        )
        continuation = generated[0, len(prompt_ids):].tolist()
        return self.tokenizer.decode(continuation)


def evaluate_prediction(prediction: str, expected: str, evaluator: str) -> bool:
    if evaluator == "exact":
        return prediction.strip() == expected.strip()
    if evaluator == "contains":
        return expected.casefold() in prediction.casefold()
    if evaluator == "regex":
        try:
            return re.search(expected, prediction, flags=re.IGNORECASE | re.DOTALL) is not None
        except re.error as exc:
            raise ValueError(f"Invalid expected regex: {exc}") from exc
    raise ValueError(f"Unsupported evaluator: {evaluator}")


def load_tasks(path: str | Path) -> list[dict[str, Any]]:
    tasks = []
    seen_ids = set()
    for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid task JSON on line {line_number}: {exc}") from exc
        required = ("id", "category", "prompt", "expected", "evaluator")
        if any(not isinstance(row.get(key), str) or not row[key].strip() for key in required):
            raise ValueError(f"Task line {line_number} is missing a non-empty required string")
        if row["id"] in seen_ids:
            raise ValueError(f"Duplicate task id: {row['id']}")
        limit = row.get("max_new_tokens", 32)
        if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
            raise ValueError(f"Task {row['id']} max_new_tokens must be a positive integer")
        if row["evaluator"] not in {"exact", "contains", "regex"}:
            raise ValueError(f"Task {row['id']} has an unsupported evaluator")
        seen_ids.add(row["id"])
        tasks.append(row)
    if not tasks:
        raise ValueError("Task dataset is empty")
    return tasks


def run_task_benchmark(adapter: GenerationAdapter, tasks: list[dict[str, Any]]) -> dict[str, Any]:
    results = []
    categories: dict[str, list[bool]] = defaultdict(list)
    for task in tasks:
        prediction = adapter.generate(
            task["prompt"], max_new_tokens=task.get("max_new_tokens", 32)
        )
        passed = evaluate_prediction(prediction, task["expected"], task["evaluator"])
        categories[task["category"]].append(passed)
        results.append({
            "id": task["id"],
            "category": task["category"],
            "evaluator": task["evaluator"],
            "passed": passed,
            "expected": task["expected"],
            "prediction": prediction,
        })
    category_summary = {
        name: {"passed": sum(scores), "total": len(scores),
               "accuracy": sum(scores) / len(scores)}
        for name, scores in sorted(categories.items())
    }
    passed = sum(item["passed"] for item in results)
    return {
        "schema_version": "1.0",
        "benchmark_kind": "deterministic-generation-task-success",
        "task_count": len(results),
        "passed": passed,
        "accuracy": passed / len(results),
        "categories": category_summary,
        "results": results,
        "limitations": [
            "Exact, contains, and regex checks are not a substitute for expert rubric grading.",
            "Conversation quality, nuanced reasoning, and open-ended coding need human or rubric evaluation.",
            "Long-context retrieval is limited by the model configuration and available prompt budget.",
            "A random or untrained checkpoint produces diagnostic output only, not meaningful capability scores.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deterministic task-success evaluation")
    parser.add_argument("--config", default="model/vxnci-1-tiny/config.json")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--tasks", required=True, help="Task dataset in JSONL format")
    parser.add_argument("--output", default="artifacts/task-benchmark-report.json")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()
    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA requested but unavailable")
    try:
        config = load_model_config(args.config)
        tokenizer = ByteBPETokenizer.load(args.tokenizer)
        if tokenizer.vocab_size != config.vocab_size:
            raise ValueError("Tokenizer vocabulary size does not match model config")
        from safetensors.torch import load_file
        model = VxnciForCausalLM(config)
        model.load_state_dict(load_file(args.checkpoint, device=args.device), strict=True)
        tasks = load_tasks(args.tasks)
        report = run_task_benchmark(
            TinyCheckpointAdapter(model, tokenizer, torch.device(args.device)), tasks
        )
        report["model"] = {
            "model_id": config.model_id,
            "checkpoint": str(args.checkpoint),
            "tokenizer": str(args.tokenizer),
            "context_length": config.context_length,
            "max_output_tokens": config.max_output_tokens,
        }
        destination = Path(args.output)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                               encoding="utf-8")
        print(json.dumps({"report": args.output, "task_count": report["task_count"],
                          "accuracy": report["accuracy"]}, indent=2))
    except (ValueError, OSError, RuntimeError, KeyError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
