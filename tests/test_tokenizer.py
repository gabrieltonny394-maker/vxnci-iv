import json
import tempfile
import unittest
from pathlib import Path

from training.tokenizer import ByteBPETokenizer, train_byte_bpe
from training.train_tokenizer import load_training_texts


class ByteBPETokenizerTests(unittest.TestCase):
    def test_round_trip_ascii_and_unicode(self):
        samples = ["hello hello", "Habari za asubuhi", "こんにちは", "M-PESA 🇰🇪"]
        tokenizer = train_byte_bpe(samples, vocab_size=300, min_pair_frequency=1)
        for sample in samples:
            self.assertEqual(tokenizer.decode(tokenizer.encode(sample)), sample)

    def test_unseen_unicode_uses_byte_fallback(self):
        tokenizer = train_byte_bpe(["hello world"], vocab_size=270, min_pair_frequency=2)
        sample = "Kiswahili: 你好 🌍"
        self.assertEqual(tokenizer.decode(tokenizer.encode(sample)), sample)

    def test_eos_is_added_and_skipped_on_decode(self):
        tokenizer = train_byte_bpe(["hello"], vocab_size=260)
        ids = tokenizer.encode("hello", add_eos=True)
        self.assertEqual(ids[-1], tokenizer.special_token_ids["<|endoftext|>"])
        self.assertEqual(tokenizer.decode(ids), "hello")

    def test_save_and_load(self):
        tokenizer = train_byte_bpe(["repeat repeat", "repeat text"], vocab_size=280,
                                   min_pair_frequency=1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tokenizer.json"
            tokenizer.save(path)
            restored = ByteBPETokenizer.load(path)
            self.assertEqual(restored.decode(restored.encode("repeat text")), "repeat text")
            self.assertEqual(restored.vocab_size, tokenizer.vocab_size)

    def test_rejects_too_small_vocabulary(self):
        with self.assertRaises(ValueError):
            train_byte_bpe(["x"], vocab_size=100)

    def test_rejects_invalid_token_id(self):
        tokenizer = train_byte_bpe(["x"], vocab_size=260)
        with self.assertRaises(ValueError):
            tokenizer.decode([tokenizer.vocab_size])


class CorpusLoaderTests(unittest.TestCase):
    def test_only_train_records_are_returned(self):
        records = [
            {"text": "training sample", "source": "public-domain-test",
             "license": "CC0-1.0", "split": "train"},
            {"text": "validation sample", "source": "public-domain-test",
             "license": "CC0-1.0", "split": "validation"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "corpus.jsonl"
            path.write_text("\n".join(json.dumps(item) for item in records), encoding="utf-8")
            self.assertEqual(load_training_texts(path), ["training sample"])

    def test_rejects_missing_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "corpus.jsonl"
            path.write_text(json.dumps({"text": "no source", "split": "train"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                load_training_texts(path)


if __name__ == "__main__":
    unittest.main()
