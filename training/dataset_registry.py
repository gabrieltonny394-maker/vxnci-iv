"""Validate LUXORA Core JSONL datasets before tokenizer or training use.

No data is accepted based on availability alone: each record must carry
provenance, explicit rights status, contributor, timestamp and split metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

SPLITS = {"train", "validation", "held_out", "safety"}
RIGHTS_STATUSES = {"approved", "quarantined"}
CONTENT_TYPES = {"original", "licensed", "public_domain", "synthetic"}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def canonical_text_hash(text: str) -> str:
    normalized = " ".join(text.split()).casefold()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def validate_dataset(path: str | Path) -> dict[str, Any]:
    """Validate JSONL records and return a privacy-conscious summary."""
    rows: list[dict[str, Any]] = []
    ids: set[str] = set()
    hashes: dict[str, tuple[int, str]] = {}
    errors: list[str] = []
    quarantined = 0

    with Path(path).open("r", encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, 1):
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
            except json.JSONDecodeError:
                errors.append(f"line {line_no}: invalid JSON")
                continue
            if not isinstance(row, dict):
                errors.append(f"line {line_no}: record must be an object")
                continue

            required = ("record_id", "text", "source", "license", "rights_status",
                        "content_type", "contributor", "created_at", "split")
            missing = [key for key in required
                       if not isinstance(row.get(key), str) or not row[key].strip()]
            if missing:
                errors.append(f"line {line_no}: missing/empty fields: {', '.join(missing)}")
                continue

            record_id = row["record_id"]
            if record_id in ids:
                errors.append(f"line {line_no}: duplicate record_id {record_id}")
            ids.add(record_id)

            if row["split"] not in SPLITS:
                errors.append(f"line {line_no}: invalid split {row['split']}")
            if row["rights_status"] not in RIGHTS_STATUSES:
                errors.append(f"line {line_no}: invalid rights_status")
            if row["content_type"] not in CONTENT_TYPES:
                errors.append(f"line {line_no}: invalid content_type")
            if row["rights_status"] != "approved":
                quarantined += 1
            if row["content_type"] == "synthetic" and not (
                isinstance(row.get("generation_method"), str) and row["generation_method"].strip()
            ):
                errors.append(f"line {line_no}: synthetic records require generation_method")

            text = row["text"]
            if not text.strip():
                errors.append(f"line {line_no}: text must not be empty")
                continue
            digest = canonical_text_hash(text)
            previous = hashes.get(digest)
            if previous:
                errors.append(
                    f"line {line_no}: duplicate/normalized duplicate of line {previous[0]} "
                    f"across split(s) {previous[1]} and {row['split']}"
                )
            else:
                hashes[digest] = (line_no, row["split"])
            rows.append(row)

    if not rows:
        errors.append("dataset contains no valid records")
    for split in ("train", "validation"):
        if not any(r.get("split") == split and r.get("rights_status") == "approved" for r in rows):
            errors.append(f"dataset has no approved {split} records")

    summary = {
        "valid": not errors,
        "records_seen": len(rows),
        "split_counts": dict(Counter(r.get("split", "invalid") for r in rows)),
        "approved_records": sum(r.get("rights_status") == "approved" for r in rows),
        "quarantined_records": quarantined,
        "errors": errors,
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a provenance-checked Core dataset")
    parser.add_argument("--data", required=True, help="JSONL dataset manifest")
    parser.add_argument("--report", help="Optional path for JSON validation report")
    args = parser.parse_args()
    result = validate_dataset(args.data)
    payload = json.dumps(result, indent=2, ensure_ascii=False)
    if args.report:
        Path(args.report).write_text(payload + "\n", encoding="utf-8")
    print(payload)
    if not result["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
