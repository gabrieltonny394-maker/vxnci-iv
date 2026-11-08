import json
import tempfile
import unittest
from pathlib import Path

import torch
from training.benchmark import benchmark_model, percentile, run_benchmark
from training.model import ModelConfig, VxnciForCausalLM
from training.tokenizer import train_byte_bpe
from training.train import save_checkpoint


class BenchmarkMetricTests(unittest.TestCase):
    def setUp(self):
        self.config = ModelConfig(
            vocab_size=260, hidden_size=16, num_layers=1,
            num_attention_heads=2, num_key_value_heads=2,
            intermediate_size=32, context_length=8, max_output_tokens=4,
        )
        self.model = VxnciForCausalLM(self.config)

    def test_percentile_rejects_empty_values(self):
        with self.assertRaises(ValueError):
            percentile([], 0.95)

    def test_percentile_uses_nearest_rank(self):
        self.assertEqual(percentile([4.0, 1.0, 3.0, 2.0], 0.5), 2.0)
        self.assertEqual(percentile([4.0, 1.0, 3.0, 2.0], 0.95), 4.0)

    def test_benchmark_reports_quality_and_runtime_metrics(self):
        loader = [
            {
                "input_ids": torch.tensor([[1, 2, 3, 4]], dtype=torch.long),
                "labels": torch.tensor([[1, 2, 3, 4]], dtype=torch.long),
            },
            {
                "input_ids": torch.tensor([[5, 6, 7, 8]], dtype=torch.long),
                "labels": torch.tensor([[5, 6, 7, 8]], dtype=torch.long),
            },
        ]
        result = benchmark_model(
            self.model, loader, device=torch.device("cpu"), warmup_batches=0
        )
        self.assertEqual(result["batches_measured"], 2)
        self.assertEqual(result["scored_tokens"], 6)
        self.assertEqual(result["max_sequence_length"], 4)
        self.assertTrue(torch.isfinite(torch.tensor(result["mean_negative_log_likelihood"])))
        self.assertGreater(result["perplexity"], 0)
        self.assertGreater(result["throughput"]["scored_tokens_per_second"], 0)
        self.assertGreaterEqual(result["batch_latency_seconds"]["p95"], 0)
        self.assertIsNone(result["peak_cuda_memory_bytes"])

    def test_benchmark_rejects_empty_loader(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            benchmark_model(self.model, [], device=torch.device("cpu"))

    def test_benchmark_rejects_all_warmup_batches(self):
        loader = [{
            "input_ids": torch.tensor([[1, 2, 3]], dtype=torch.long),
            "labels": torch.tensor([[1, 2, 3]], dtype=torch.long),
        }]
        with self.assertRaisesRegex(ValueError, "No benchmark batches"):
            benchmark_model(
                self.model, loader, device=torch.device("cpu"), warmup_batches=1
            )

    def test_end_to_end_checkpoint_benchmark_writes_hashed_report(self):
        from safetensors.torch import load_file

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.json"
            config_path.write_text(json.dumps({
                "modelId": self.config.model_id,
                "parameters": {
                    "vocabSize": self.config.vocab_size,
                    "hiddenSize": self.config.hidden_size,
                    "numLayers": self.config.num_layers,
                    "numAttentionHeads": self.config.num_attention_heads,
                    "numKeyValueHeads": self.config.num_key_value_heads,
                    "intermediateSize": self.config.intermediate_size,
                    "contextLength": self.config.context_length,
                    "maxOutputTokens": self.config.max_output_tokens,
                    "tieWordEmbeddings": self.config.tie_word_embeddings,
                    "useBias": self.config.use_bias,
                },
            }), encoding="utf-8")

            tokenizer = train_byte_bpe(
                ["original training passage for tokenizer fitting"],
                vocab_size=self.config.vocab_size,
            )
            tokenizer_path = root / "tokenizer.json"
            tokenizer.save(tokenizer_path)

            corpus_path = root / "corpus.jsonl"
            rows = [
                {"text": "original training passage", "source": "local-authored",
                 "license": "original", "split": "train"},
                {"text": "held out validation passage", "source": "local-authored",
                 "license": "original", "split": "validation"},
            ]
            corpus_path.write_text(
                "".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8"
            )

            optimizer = torch.optim.AdamW(self.model.parameters(), lr=0.001)
            checkpoint_dir = root / "checkpoint"
            save_checkpoint(self.model, optimizer, checkpoint_dir, {"model_id": self.config.model_id})
            checkpoint_path = checkpoint_dir / "model.safetensors"
            # Ensure the generated checkpoint can be read before invoking the runner.
            self.assertIn("token_embedding.weight", load_file(str(checkpoint_path)))

            output_path = root / "report.json"
            report = run_benchmark(
                config_path=config_path,
                checkpoint_path=checkpoint_path,
                tokenizer_path=tokenizer_path,
                corpus_path=corpus_path,
                output_path=output_path,
                batch_size=1,
                device_name="cpu",
                warmup_batches=0,
            )
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(report["benchmark_kind"], "held-out-next-token-and-runtime")
            self.assertEqual(persisted["dataset"]["split_used"], "validation")
            self.assertEqual(persisted["dataset"]["validation_documents"], 1)
            self.assertEqual(len(persisted["model"]["checkpoint_sha256"]), 64)
            self.assertIn("needle-in-a-haystack retrieval", persisted["not_evaluated"])
            self.assertGreater(persisted["measurements"]["scored_tokens"], 0)


if __name__ == "__main__":
    unittest.main()
