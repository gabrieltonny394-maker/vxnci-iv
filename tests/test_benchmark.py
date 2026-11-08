import json
import tempfile
import unittest
from pathlib import Path

import torch
from torch.utils.data import DataLoader, TensorDataset

from training.benchmark import benchmark_model, percentile
from training.model import ModelConfig, VxnciForCausalLM


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


if __name__ == "__main__":
    unittest.main()
