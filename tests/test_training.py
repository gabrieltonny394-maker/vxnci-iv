import json
import tempfile
import unittest
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from training.data import TokenBlockDataset, load_corpus_records
from training.model import ModelConfig, VxnciForCausalLM
from training.train import learning_rate_at_step, save_checkpoint, train_model
from training.tokenizer import train_byte_bpe


class TrainingDataTests(unittest.TestCase):
    def write_corpus(self, directory, records):
        path = Path(directory) / "corpus.jsonl"
        path.write_text("".join(json.dumps(row) + "\n" for row in records), encoding="utf-8")
        return path

    def test_train_and_validation_are_separated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_corpus(directory, [
                {"text": "training example", "source": "local-authored", "license": "original", "split": "train"},
                {"text": "held out example", "source": "local-authored", "license": "original", "split": "validation"},
            ])
            train, validation = load_corpus_records(path)
            self.assertEqual(train, ["training example"])
            self.assertEqual(validation, ["held out example"])

    def test_missing_provenance_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_corpus(directory, [
                {"text": "unverified text", "source": "", "license": "unknown", "split": "train"},
                {"text": "validation text", "source": "author", "license": "original", "split": "validation"},
            ])
            with self.assertRaisesRegex(ValueError, "provenance"):
                load_corpus_records(path)

    def test_missing_validation_split_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_corpus(directory, [
                {"text": "training example", "source": "author", "license": "original", "split": "train"},
            ])
            with self.assertRaisesRegex(ValueError, "no validation"):
                load_corpus_records(path)

    def test_token_blocks_are_padded_and_masked(self):
        tokenizer = train_byte_bpe(["hello world", "another example"], vocab_size=260)
        dataset = TokenBlockDataset(["hello"], tokenizer, context_length=8, model_vocab_size=8192)
        sample = dataset[0]
        self.assertEqual(tuple(sample["input_ids"].shape), (8,))
        self.assertEqual(tuple(sample["labels"].shape), (8,))
        self.assertEqual(int(sample["labels"][-1]), -100)

    def test_tokenizer_larger_than_model_is_rejected(self):
        tokenizer = train_byte_bpe(["hello world"], vocab_size=260)
        with self.assertRaisesRegex(ValueError, "exceeds model"):
            TokenBlockDataset(["hello"], tokenizer, context_length=8, model_vocab_size=259)



class TrainingLoopTests(unittest.TestCase):
    def test_learning_rate_warmup_and_decay(self):
        self.assertAlmostEqual(learning_rate_at_step(0, 10, 2, 0.001), 0.0005)
        self.assertAlmostEqual(learning_rate_at_step(9, 10, 2, 0.001), 0.0)

    def test_one_step_training_and_validation(self):
        tokenizer = train_byte_bpe(["hello world", "training text", "validation text"], vocab_size=260)
        train_data = TokenBlockDataset(["hello world", "training text"], tokenizer, 8, 260)
        validation_data = TokenBlockDataset(["validation text"], tokenizer, 8, 260)
        train_loader = DataLoader(train_data, batch_size=1, shuffle=False)
        validation_loader = DataLoader(validation_data, batch_size=1)
        config = ModelConfig(vocab_size=260, hidden_size=16, num_layers=1,
            num_attention_heads=2, num_key_value_heads=2, intermediate_size=32,
            context_length=8, max_output_tokens=4)
        model = VxnciForCausalLM(config)
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.001)
        result = train_model(model, train_loader, validation_loader,
            device=torch.device("cpu"), epochs=1, learning_rate=0.001,
            warmup_steps=0, max_steps=1, optimizer=optimizer)
        self.assertEqual(result["completed_steps"], 1)
        self.assertTrue(torch.isfinite(torch.tensor(result["validation_loss"])))
        self.assertGreater(len(optimizer.state), 0)


    def test_checkpoint_writes_weights_optimizer_and_metadata(self):
        from safetensors.torch import load_file

        config = ModelConfig(vocab_size=260, hidden_size=16, num_layers=1,
            num_attention_heads=2, num_key_value_heads=2, intermediate_size=32,
            context_length=8, max_output_tokens=4)
        model = VxnciForCausalLM(config)
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.001)
        with tempfile.TemporaryDirectory() as directory:
            save_checkpoint(model, optimizer, directory, {"model_id": config.model_id})
            root = Path(directory)
            weights = load_file(str(root / "model.safetensors"))
            self.assertIn("token_embedding.weight", weights)
            self.assertTrue((root / "optimizer_state.pt").exists())
            metadata = json.loads((root / "training_state.json").read_text(encoding="utf-8"))
            self.assertEqual(metadata["model_id"], config.model_id)

if __name__ == "__main__":
    unittest.main()
