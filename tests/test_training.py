import json
import tempfile
import unittest
from pathlib import Path

from training.data import TokenBlockDataset, load_corpus_records
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


if __name__ == "__main__":
    unittest.main()
