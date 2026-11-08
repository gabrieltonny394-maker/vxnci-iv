"""Local CPU-first training entry point for VXNCI-1 Tiny.

No corpus is bundled or downloaded. The operator must provide a provenance-
documented JSONL corpus and a tokenizer trained from its training split.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader

from training.data import TokenBlockDataset, load_corpus_records
from training.dataset_registry import validate_dataset
from training.model import VxnciForCausalLM, load_model_config
from training.tokenizer import ByteBPETokenizer


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def learning_rate_at_step(step: int, total_steps: int, warmup_steps: int, base_lr: float) -> float:
    if warmup_steps > 0 and step < warmup_steps:
        return base_lr * float(step + 1) / float(warmup_steps)
    decay_steps = max(1, total_steps - warmup_steps - 1)
    progress = min(1.0, max(0.0, (step - warmup_steps) / decay_steps))
    return base_lr * 0.5 * (1.0 + math.cos(math.pi * progress))


@torch.no_grad()
def evaluate(model: VxnciForCausalLM, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    losses: list[float] = []
    for batch in loader:
        input_ids = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)
        output = model(input_ids, labels=labels)
        loss = output.get("loss")
        if loss is not None and torch.isfinite(loss):
            losses.append(float(loss.item()))
    if not losses:
        raise ValueError("Validation produced no finite loss values")
    return sum(losses) / len(losses)


def train_model(
    model: VxnciForCausalLM,
    train_loader: DataLoader,
    validation_loader: DataLoader,
    *,
    device: torch.device,
    epochs: int,
    learning_rate: float,
    warmup_steps: int,
    max_steps: int | None = None,
    seed: int = 42,
    optimizer: torch.optim.Optimizer | None = None,
) -> dict[str, Any]:
    if epochs < 1 or learning_rate <= 0 or warmup_steps < 0:
        raise ValueError("epochs and learning rate must be positive; warmup cannot be negative")
    if max_steps is not None and max_steps < 1:
        raise ValueError("max_steps must be positive when provided")
    set_seed(seed)
    model.to(device)
    optimizer = optimizer or torch.optim.AdamW(model.parameters(), lr=learning_rate)
    steps_per_epoch = len(train_loader)
    total_steps = max_steps or (steps_per_epoch * epochs)
    if total_steps < 1:
        raise ValueError("Training dataset is empty")

    step = 0
    history: list[dict[str, float | int]] = []
    stop = False
    for epoch in range(epochs):
        model.train()
        for batch in train_loader:
            if step >= total_steps:
                stop = True
                break
            lr = learning_rate_at_step(step, total_steps, warmup_steps, learning_rate)
            for group in optimizer.param_groups:
                group["lr"] = lr
            input_ids = batch["input_ids"].to(device)
            labels = batch["labels"].to(device)
            optimizer.zero_grad(set_to_none=True)
            output = model(input_ids, labels=labels)
            loss = output.get("loss")
            if loss is None or not torch.isfinite(loss):
                raise RuntimeError("Training loss is missing or non-finite")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            step += 1
            history.append({"step": step, "train_loss": float(loss.detach().item()), "learning_rate": lr})
        if stop:
            break

    validation_loss = evaluate(model, validation_loader, device)
    return {
        "completed_steps": step,
        "epochs_requested": epochs,
        "train_examples": len(train_loader.dataset),
        "validation_examples": len(validation_loader.dataset),
        "validation_loss": validation_loss,
        "history": history,
        "seed": seed,
        "device": str(device),
    }


def save_checkpoint(
    model: VxnciForCausalLM,
    optimizer: torch.optim.Optimizer,
    output_dir: str | Path,
    metadata: dict[str, Any],
) -> None:
    try:
        from safetensors.torch import save_file
    except ImportError as exc:
        raise RuntimeError("Install safetensors from requirements-training.txt to save checkpoints") from exc

    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    # Clone tied/shared tensors so safetensors receives independent contiguous storage.
    state = {name: tensor.detach().cpu().contiguous().clone()
             for name, tensor in model.state_dict().items()}
    save_file(state, str(destination / "model.safetensors"))
    torch.save(optimizer.state_dict(), destination / "optimizer_state.pt")
    (destination / "training_state.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train VXNCI-1 Tiny locally")
    parser.add_argument("--data", required=True, help="Provenance-documented UTF-8 JSONL corpus")
    parser.add_argument("--tokenizer", required=True, help="Previously trained tokenizer JSON")
    parser.add_argument("--config", default="model/vxnci-1-tiny/config.json")
    parser.add_argument("--output-dir", default="artifacts/vxnci-1-tiny/checkpoint")
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--warmup-steps", type=int, default=10)
    parser.add_argument("--max-steps", type=int)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA was requested but is not available")

    set_seed(args.seed)
    config = load_model_config(args.config)
    tokenizer = ByteBPETokenizer.load(args.tokenizer)
    dataset_report = validate_dataset(args.data)
    if not dataset_report["valid"]:
        raise ValueError("Dataset failed governance validation: " + "; ".join(dataset_report["errors"]))
    train_texts, validation_texts = load_corpus_records(args.data)
    train_data = TokenBlockDataset(train_texts, tokenizer, config.context_length, config.vocab_size)
    validation_data = TokenBlockDataset(validation_texts, tokenizer, config.context_length, config.vocab_size)
    generator = torch.Generator().manual_seed(args.seed)
    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True, generator=generator)
    validation_loader = DataLoader(validation_data, batch_size=args.batch_size, shuffle=False)

    model = VxnciForCausalLM(config)
    device = torch.device(args.device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    result = train_model(
        model, train_loader, validation_loader, device=device,
        epochs=args.epochs, learning_rate=args.learning_rate,
        warmup_steps=args.warmup_steps, max_steps=args.max_steps, seed=args.seed,
        optimizer=optimizer,
    )
    result.update({
        "model_id": config.model_id,
        "config": str(args.config),
        "tokenizer": str(args.tokenizer),
        "corpus": str(args.data),
        "checkpoint_format": "safetensors",
        "dataset_validation": dataset_report,
    })
    save_checkpoint(model, optimizer, args.output_dir, result)
    print(json.dumps({key: value for key, value in result.items() if key != "history"}, indent=2))


if __name__ == "__main__":
    main()
