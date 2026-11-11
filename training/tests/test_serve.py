"""Tests for the local inference service loading and generation boundary."""
from __future__ import annotations

import json
from pathlib import Path

import torch
from safetensors.torch import save_file

from training.model import ModelConfig, VxnciForCausalLM
from training.serve import generate, load_runtime
from training.tokenizer import ByteBPETokenizer


def _fixture(tmp_path: Path):
    config = ModelConfig(
        model_id="vxnci-test",
        vocab_size=260,
        hidden_size=16,
        num_layers=1,
        num_attention_heads=2,
        num_key_value_heads=2,
        intermediate_size=32,
        context_length=32,
        max_output_tokens=8,
    )
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({
        "modelId": config.model_id,
        "parameters": {
            "vocabSize": config.vocab_size,
            "hiddenSize": config.hidden_size,
            "numLayers": config.num_layers,
            "numAttentionHeads": config.num_attention_heads,
            "numKeyValueHeads": config.num_key_value_heads,
            "intermediateSize": config.intermediate_size,
            "contextLength": config.context_length,
            "maxOutputTokens": config.max_output_tokens,
            "tieWordEmbeddings": True,
            "useBias": False,
        },
    }), encoding="utf-8")
    tokenizer = ByteBPETokenizer(
        token_bytes=[bytes([i]) for i in range(256)] + [None] * 4,
        merges=[],
    )
    tokenizer_path = tmp_path / "tokenizer.json"
    tokenizer.save(tokenizer_path)
    model = VxnciForCausalLM(config)
    checkpoint = tmp_path / "model.safetensors"
    save_file({k: v.detach().cpu().contiguous().clone()
               for k, v in model.state_dict().items()}, str(checkpoint))
    state_path = tmp_path / "training_state.json"
    state_path.write_text(json.dumps({
        "model_id": config.model_id,
        "completed_steps": 2,
        "validation_loss": 5.0,
        "dataset_validation": {"valid": True},
    }), encoding="utf-8")
    return config_path, tokenizer_path, checkpoint, state_path


def test_load_runtime_requires_training_state(tmp_path: Path):
    config, tokenizer, checkpoint, state = _fixture(tmp_path)
    state.unlink()
    try:
        load_runtime(config, tokenizer, checkpoint, state)
        assert False, "expected missing training metadata to be rejected"
    except FileNotFoundError as exc:
        assert "Training state metadata is required" in str(exc)


def test_load_runtime_rejects_unvalidated_corpus(tmp_path: Path):
    config, tokenizer, checkpoint, state = _fixture(tmp_path)
    payload = json.loads(state.read_text(encoding="utf-8"))
    payload["dataset_validation"] = {"valid": False}
    state.write_text(json.dumps(payload), encoding="utf-8")
    try:
        load_runtime(config, tokenizer, checkpoint, state)
        assert False, "expected unvalidated corpus to be rejected"
    except ValueError as exc:
        assert "provenance validation" in str(exc)


def test_load_runtime_and_generate_with_a_checkpoint(tmp_path: Path):
    config, tokenizer, checkpoint, state = _fixture(tmp_path)
    runtime = load_runtime(config, tokenizer, checkpoint, state)
    result = generate(runtime, [{"role": "user", "content": "Hello"}], 2)
    assert result["model"] == "vxnci-test"
    assert isinstance(result["text"], str) and result["text"]
    assert result["usage"]["input_tokens"] > 0
    assert result["usage"]["output_tokens"] <= 2
