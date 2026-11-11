"""Unit tests for the local PyTorch inference service."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import torch
from safetensors.torch import save_file

from training.model import ModelConfig, VxnciForCausalLM
from training.serve import generate, load_runtime
from training.tokenizer import ByteBPETokenizer


class InferenceServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
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
        self.config_path = root / "config.json"
        self.config_path.write_text(json.dumps({
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
        self.tokenizer_path = root / "tokenizer.json"
        tokenizer.save(self.tokenizer_path)
        model = VxnciForCausalLM(config)
        self.checkpoint_path = root / "model.safetensors"
        save_file({k: v.detach().cpu().contiguous().clone()
                   for k, v in model.state_dict().items()}, str(self.checkpoint_path))
        self.state_path = root / "training_state.json"
        self.state_path.write_text(json.dumps({
            "model_id": config.model_id,
            "completed_steps": 2,
            "validation_loss": 5.0,
            "dataset_validation": {"valid": True},
        }), encoding="utf-8")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def load(self):
        return load_runtime(
            self.config_path, self.tokenizer_path,
            self.checkpoint_path, self.state_path,
        )

    def test_load_runtime_requires_training_state(self) -> None:
        self.state_path.unlink()
        with self.assertRaisesRegex(FileNotFoundError, "Training state metadata is required"):
            self.load()

    def test_load_runtime_rejects_unvalidated_corpus(self) -> None:
        payload = json.loads(self.state_path.read_text(encoding="utf-8"))
        payload["dataset_validation"] = {"valid": False}
        self.state_path.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "provenance validation"):
            self.load()

    def test_load_runtime_and_generate_with_checkpoint(self) -> None:
        runtime = self.load()

        def deterministic_generate(input_ids, *, max_new_tokens, eos_token_id):
            generated = torch.tensor([[ord("O"), ord("K")]], dtype=torch.long)
            return torch.cat((input_ids, generated), dim=1)

        runtime.model.generate = deterministic_generate
        result = generate(runtime, [{"role": "user", "content": "Hello"}], 2)
        self.assertEqual(result["model"], "vxnci-test")
        self.assertEqual(result["text"], "OK")
        self.assertGreater(result["usage"]["input_tokens"], 0)
        self.assertEqual(result["usage"]["output_tokens"], 2)


if __name__ == "__main__":
    unittest.main()
