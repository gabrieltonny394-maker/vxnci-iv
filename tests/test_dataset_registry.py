import json
import tempfile
import unittest
from pathlib import Path

from training.dataset_registry import validate_dataset


def record(record_id, text, split="train", **extra):
    row = {
        "record_id": record_id, "text": text, "source": "created-in-project",
        "license": "original", "rights_status": "approved",
        "content_type": "original", "contributor": "project-owner",
        "created_at": "2026-11-08", "split": split,
    }
    row.update(extra)
    return row


class DatasetRegistryTests(unittest.TestCase):
    def validate_rows(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "dataset.jsonl"
            path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
            return validate_dataset(path)

    def test_approved_train_and_validation_pass(self):
        result = self.validate_rows([
            record("r1", "Explain gravity simply.", "train"),
            record("r2", "What is a prime number?", "validation"),
        ])
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["approved_records"], 2)

    def test_missing_provenance_fails(self):
        row = record("r1", "Training text")
        row.pop("source")
        result = self.validate_rows([row, record("r2", "Validation text", "validation")])
        self.assertFalse(result["valid"])
        self.assertTrue(any("source" in error for error in result["errors"]))

    def test_duplicate_text_across_splits_fails(self):
        result = self.validate_rows([
            record("r1", "Same exact text", "train"),
            record("r2", " same   exact TEXT ", "validation"),
        ])
        self.assertFalse(result["valid"])
        self.assertTrue(any("duplicate" in error for error in result["errors"]))

    def test_duplicate_ids_fail(self):
        result = self.validate_rows([
            record("same", "First example", "train"),
            record("same", "Second example", "validation"),
        ])
        self.assertFalse(result["valid"])
        self.assertTrue(any("duplicate record_id" in error for error in result["errors"]))

    def test_unapproved_record_is_quarantined_not_accepted(self):
        result = self.validate_rows([
            record("r1", "Approved training", "train"),
            record("r2", "Approved validation", "validation"),
            record("r3", "Partner sample", "train", rights_status="quarantined"),
        ])
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["quarantined_records"], 1)
        self.assertEqual(result["approved_records"], 2)

    def test_synthetic_requires_method(self):
        result = self.validate_rows([
            record("r1", "Training text", "train", content_type="synthetic"),
            record("r2", "Validation text", "validation"),
        ])
        self.assertFalse(result["valid"])
        self.assertTrue(any("generation_method" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
