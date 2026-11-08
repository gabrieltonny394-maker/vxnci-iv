# LUXORA Core — Dataset Pipeline

**Owner:** LUXORA CLUB  
**Division:** LUXORA INTELLIGENCE  
**Product:** LUXORA AI  
**Model:** LUXORA Core  
**Branch:** `develop/vxnci-foundation`

## Purpose

This is the first controlled data-ingestion layer for training experiments. It does not supply a training corpus and does not certify that a source is legally usable. The dataset owner must verify rights and record evidence before setting a record to `approved`.

## Record format

One JSON object per UTF-8 JSONL line:

```json
{
  "record_id": "core-example-0001",
  "text": "An original example or permitted text goes here.",
  "source": "creator-and-origin-description",
  "license": "original-owner-created",
  "rights_status": "approved",
  "content_type": "original",
  "contributor": "approved-contributor-id",
  "created_at": "2026-11-08",
  "split": "train"
}
```

Required fields: `record_id`, `text`, `source`, `license`, `rights_status`, `content_type`, `contributor`, `created_at`, and `split`.

Allowed splits: `train`, `validation`, `held_out`, `safety`. Allowed rights states: `approved`, `quarantined`. Content types: `original`, `licensed`, `public_domain`, `synthetic`. Synthetic records also require `generation_method`.

Do not put personal, confidential, secret, or sensitive data into the corpus. Contributor identity should be a controlled project identifier, not unnecessary personal details. Keep licence/permission evidence in a separate access-controlled register.

## Validation

Run:

```bash
python -m training.dataset_registry --data path/to/dataset.jsonl --report dataset-report.json
```

The validator checks required provenance fields, allowed metadata values, duplicate IDs, normalized exact-text duplicates across splits, presence of approved train and validation examples, and synthetic-data labelling. A quarantined record is counted but is not treated as approved. Any validation error exits non-zero.

The validator deliberately does not make legal judgements, detect semantic/near-duplicate paraphrases, prove contributor identity, verify licence claims, or perform privacy/safety review. Those remain mandatory human review gates.

## Training isolation

Only approved `train` and `validation` records may be passed to the tokenizer/training pipeline. Held-out and safety records must remain isolated and must never be used for tokenizer fitting, training, prompt tuning, or iterative model selection. Partner data remains quarantined until separately reviewed and approved.

## Current status

The pipeline is tooling, not a dataset. No example corpus, partner contribution, licence, or trained model is implied. Begin with a small set of genuinely original examples and separately authored validation examples. Keep a copy of the validation report with each dataset version.
