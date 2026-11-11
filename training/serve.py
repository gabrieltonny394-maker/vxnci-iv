"""Local HTTP inference service for a trained VXNCI-1 Tiny checkpoint.

This service never initializes random weights as a usable model. It requires a
checkpoint, tokenizer, and training metadata that passed corpus validation.
Bind to localhost by default; protect generation with LUXORA_INFERENCE_TOKEN.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import torch
from safetensors.torch import load_file

from training.model import VxnciForCausalLM, load_model_config
from training.tokenizer import ByteBPETokenizer


@dataclass
class LoadedRuntime:
    model_id: str
    model: VxnciForCausalLM
    tokenizer: ByteBPETokenizer
    context_length: int
    max_output_tokens: int
    lock: threading.Lock


def load_runtime(config_path: str | Path, tokenizer_path: str | Path,
                 checkpoint_path: str | Path, training_state_path: str | Path) -> LoadedRuntime:
    config = load_model_config(config_path)
    tokenizer = ByteBPETokenizer.load(tokenizer_path)
    if tokenizer.vocab_size > config.vocab_size:
        raise ValueError("Tokenizer vocabulary exceeds model vocabulary")

    state_path = Path(training_state_path)
    if not state_path.is_file():
        raise FileNotFoundError("Training state metadata is required; random weights are not served")
    training_state = json.loads(state_path.read_text(encoding="utf-8"))
    if training_state.get("model_id") != config.model_id:
        raise ValueError("Training state model_id does not match model configuration")
    if not isinstance(training_state.get("completed_steps"), int) or training_state["completed_steps"] < 1:
        raise ValueError("Checkpoint must contain at least one completed training step")
    validation = training_state.get("dataset_validation")
    if not isinstance(validation, dict) or validation.get("valid") is not True:
        raise ValueError("Checkpoint dataset provenance validation is missing or unsuccessful")
    if not isinstance(training_state.get("validation_loss"), (int, float)) or not math.isfinite(training_state["validation_loss"]):
        raise ValueError("Checkpoint validation loss must be a finite number")

    weights = Path(checkpoint_path)
    if not weights.is_file():
        raise FileNotFoundError(f"Model checkpoint not found: {weights}")
    model = VxnciForCausalLM(config)
    state = load_file(str(weights), device="cpu")
    model.load_state_dict(state, strict=True)
    model.eval()
    return LoadedRuntime(
        model_id=config.model_id,
        model=model,
        tokenizer=tokenizer,
        context_length=config.context_length,
        max_output_tokens=config.max_output_tokens,
        lock=threading.Lock(),
    )


def encode_messages(runtime: LoadedRuntime, messages: list[dict[str, str]]) -> list[int]:
    ids: list[int] = []
    special = runtime.tokenizer.special_token_ids
    for message in messages:
        role, content = message.get("role"), message.get("content")
        if role not in ("system", "user", "assistant") or not isinstance(content, str):
            raise ValueError("Each message must have a supported role and string content")
        if role == "system":
            ids.extend(runtime.tokenizer.encode("System: " + content + "\n"))
        else:
            ids.append(special["<|user|>" if role == "user" else "<|assistant|>"])
            ids.extend(runtime.tokenizer.encode(content))
            ids.append(special["<|endoftext|>"])
    ids.append(special["<|assistant|>"])
    return ids


def generate(runtime: LoadedRuntime, messages: list[dict[str, str]],
             max_output_tokens: int) -> dict[str, Any]:
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty array")
    if not isinstance(max_output_tokens, int) or isinstance(max_output_tokens, bool) or max_output_tokens < 1:
        raise ValueError("max_output_tokens must be a positive integer")
    output_limit = min(max_output_tokens, runtime.max_output_tokens)
    prompt_ids = encode_messages(runtime, messages)
    if len(prompt_ids) >= runtime.context_length:
        prompt_ids = prompt_ids[-(runtime.context_length - output_limit):]
    if not prompt_ids:
        raise ValueError("Prompt is too long for the configured context window")

    input_tensor = torch.tensor([prompt_ids], dtype=torch.long)
    eos_id = runtime.tokenizer.special_token_ids["<|endoftext|>"]
    with runtime.lock, torch.inference_mode():
        result = runtime.model.generate(
            input_tensor,
            max_new_tokens=min(output_limit, runtime.context_length - len(prompt_ids)),
            eos_token_id=eos_id,
        )
    generated_ids = result[0, len(prompt_ids):].tolist()
    text = runtime.tokenizer.decode(generated_ids).strip()
    if not text:
        raise RuntimeError("The model generated no user-visible text")
    return {
        "model": runtime.model_id,
        "text": text,
        "finish_reason": "stop" if len(generated_ids) < output_limit else "length",
        "usage": {"input_tokens": len(prompt_ids), "output_tokens": len(generated_ids)},
    }


def make_handler(runtime: LoadedRuntime, token: str):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if urlparse(self.path).path == "/health":
                self._json(200, {"status": "ready", "model_id": runtime.model_id})
            else:
                self._json(404, {"error": "not_found"})

        def do_POST(self) -> None:
            if urlparse(self.path).path != "/v1/generate":
                self._json(404, {"error": "not_found"})
                return
            if not token or self.headers.get("Authorization") != "Bearer " + token:
                self._json(401, {"error": "unauthorized"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 1 or length > 1_048_576:
                    raise ValueError("Request body size is invalid")
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError("Request body must be a JSON object")
                result = generate(runtime, payload.get("messages"), payload.get("max_output_tokens", 128))
                self._json(200, result)
            except (ValueError, json.JSONDecodeError) as exc:
                self._json(400, {"error": str(exc)})
            except Exception:
                self._json(500, {"error": "inference_failed"})

        def log_message(self, format: str, *args: Any) -> None:
            return

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve a trained VXNCI-1 Tiny checkpoint locally")
    parser.add_argument("--config", default="model/vxnci-1-tiny/config.json")
    parser.add_argument("--tokenizer", default="artifacts/vxnci-1-tiny/tokenizer.json")
    parser.add_argument("--checkpoint", default="artifacts/vxnci-1-tiny/checkpoint/model.safetensors")
    parser.add_argument("--training-state", default="artifacts/vxnci-1-tiny/checkpoint/training_state.json")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()
    token = os.environ.get("LUXORA_INFERENCE_TOKEN", "")
    if not token:
        parser.error("Set LUXORA_INFERENCE_TOKEN before starting the inference service")

    runtime = load_runtime(args.config, args.tokenizer, args.checkpoint, args.training_state)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(runtime, token))
    print(json.dumps({"status": "ready", "model_id": runtime.model_id, "host": args.host, "port": args.port}))
    server.serve_forever()


if __name__ == "__main__":
    main()
