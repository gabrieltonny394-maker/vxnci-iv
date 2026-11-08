import json
import tempfile
import unittest
from pathlib import Path

import torch

from training.model import ModelConfig, VxnciForCausalLM
from training.task_benchmark import (
    TinyCheckpointAdapter, evaluate_prediction, load_tasks, run_task_benchmark,
)
from training.tokenizer import train_byte_bpe


class FakeAdapter:
    def generate(self, prompt: str, *, max_new_tokens: int) -> str:
        return {"math": "4", "code": "print(1 + 1)", "chat": "Hello there!"}[prompt]


class TaskEvaluatorTests(unittest.TestCase):
    def test_exact_contains_and_regex(self):
        self.assertTrue(evaluate_prediction(" 42 ", "42", "exact"))
        self.assertTrue(evaluate_prediction("The answer is FOUR.", "four", "contains"))
        self.assertTrue(evaluate_prediction("value: 17", r"\\d{2}", "regex"))

    def test_invalid_regex_and_evaluator_rejected(self):
        with self.assertRaisesRegex(ValueError, "Invalid expected regex"):
            evaluate_prediction("x", "[", "regex")
        with self.assertRaisesRegex(ValueError, "Unsupported evaluator"):
            evaluate_prediction("x", "x", "fuzzy")

    def test_task_file_validation_and_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tasks.jsonl"
            path.write_text(
                json.dumps({"id":"a","category":"math","prompt":"math",
                            "expected":"4","evaluator":"exact"}) + "\\n" +
                json.dumps({"id":"a","category":"math","prompt":"math",
                            "expected":"4","evaluator":"exact"}) + "\\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "Duplicate task id"):
                load_tasks(path)

    def test_task_report_has_overall_and_category_scores(self):
        tasks = [
            {"id":"m1","category":"mathematics","prompt":"math","expected":"4","evaluator":"exact"},
            {"id":"c1","category":"coding","prompt":"code","expected":"print","evaluator":"contains"},
            {"id":"d1","category":"conversation","prompt":"chat","expected":"Goodbye","evaluator":"contains"},
        ]
        report = run_task_benchmark(FakeAdapter(), tasks)
        self.assertEqual(report["task_count"], 3)
        self.assertEqual(report["passed"], 2)
        self.assertAlmostEqual(report["accuracy"], 2 / 3)
        self.assertEqual(report["categories"]["coding"]["accuracy"], 1.0)
        self.assertFalse(report["results"][2]["passed"])
        self.assertTrue(any("untrained checkpoint" in item for item in report["limitations"]))

    def test_model_greedy_generation_and_limits(self):
        config = ModelConfig(vocab_size=260, hidden_size=16, num_layers=1,
            num_attention_heads=2, num_key_value_heads=2, intermediate_size=32,
            context_length=8, max_output_tokens=4)
        model = VxnciForCausalLM(config).eval()
        prompt = torch.tensor([[65, 66]], dtype=torch.long)
        generated = model.generate(prompt, max_new_tokens=2)
        self.assertEqual(tuple(generated.shape), (1, 4))
        self.assertTrue(torch.equal(generated[:, :2], prompt))
        with self.assertRaisesRegex(ValueError, "context window"):
            model.generate(prompt, max_new_tokens=7)
        with self.assertRaisesRegex(ValueError, "output limit"):
            model.generate(prompt, max_new_tokens=5)

    def test_tiny_adapter_generates_text_with_local_tokenizer(self):
        tokenizer = train_byte_bpe(["test"], vocab_size=260)
        config = ModelConfig(vocab_size=260, hidden_size=16, num_layers=1,
            num_attention_heads=2, num_key_value_heads=2, intermediate_size=32,
            context_length=8, max_output_tokens=4)
        model = VxnciForCausalLM(config)
        adapter = TinyCheckpointAdapter(model, tokenizer, torch.device("cpu"))
        self.assertIsInstance(adapter.generate("A", max_new_tokens=1), str)


if __name__ == "__main__":
    unittest.main()
