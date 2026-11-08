# LUXORA Core — Collaboration and Dataset Governance Plan

**Owner:** LUXORA CLUB  
**AI technology division:** LUXORA INTELLIGENCE  
**Product:** LUXORA AI  
**Model:** LUXORA Core  
**Development branch:** `develop/vxnci-foundation`  
**Status:** Governance plan; no external partnership, dataset licence, or contribution is implied by this document.

## 1. Purpose

LUXORA Core may be developed with help from both independent contributors and external organisations, including AI companies and model providers. Collaboration must strengthen the project without surrendering LUXORA's technical independence, data rights, or control of its roadmap.

This document is an internal operating policy. It is not a partnership offer, contract, data-processing agreement, or legal opinion. Obtain qualified legal review before signing agreements or accepting sensitive, personal, confidential, or commercially restricted data.

## 2. Two collaboration tracks

### Track A — People and institutions

Potential roles:
- AI and machine-learning researchers: architecture review, training methodology, evaluation design.
- Software and infrastructure developers: reproducibility, tooling, performance, security.
- Data contributors and domain experts: create or review original examples in clearly defined subject areas.
- Universities and research groups: supervised research, independent evaluation, and educational collaboration.
- Safety, privacy, and language reviewers: assess harmful outputs, bias, multilingual quality, and data handling.

Contributors receive only the access needed for their agreed task. No one receives repository write access, raw datasets, credentials, model checkpoints, or private business information by default.

### Track B — AI companies and model providers

Potential collaboration types:
- Research exchange: public papers, technical discussions, and non-confidential findings.
- Independent evaluation: compare LUXORA Core against external systems using lawful, documented test conditions.
- Infrastructure evaluation: assess compute, storage, or deployment options before any purchase.
- Licensed technology or data: consider only after written terms, provenance checks, cost review, and explicit owner approval.
- Interoperability: optional integrations may be evaluated, but LUXORA Core must remain independently identifiable and its own model weights must not be misrepresented.

Using an external API or checkpoint for a task does not make that system a LUXORA model. Third-party model use must be disclosed in internal records and any relevant product claims.

## 3. Non-negotiable ownership and access principles

1. LUXORA retains control of its brand, roadmap, repository, original training code, and independently created model artifacts, subject to applicable law and signed agreements.
2. No contributor's pre-existing intellectual property is assumed to transfer to LUXORA. Record background IP separately from newly created work.
3. Every contribution must have a written record stating creator, date, scope, source, licence or permission, permitted uses, attribution requirements, and any restrictions.
4. No dataset, model, code, or content may be accepted merely because it is publicly accessible or technically downloadable.
5. Do not use confidential, leaked, private, personal, or copyrighted material without a valid legal basis and documented permission.
6. No partner may use LUXORA data, prompts, weights, code, or evaluation results for its own training or redistribution unless a separate written agreement expressly allows it.
7. No exclusivity, assignment of core IP, sublicensing, publication of confidential details, or transfer of model weights without explicit approval and written terms.
8. Access is least-privilege, time-bounded where possible, logged, and revocable.
9. Secrets, API keys, personal data, and private partner materials must never be committed to the repository.
10. All external commitments, paid services, purchases, and public partnership announcements require explicit owner approval.

## 4. Dataset separation

Maintain physically or logically separate datasets and storage locations:

- **Training dataset:** approved examples permitted for model learning.
- **Validation dataset:** approved examples used during development and model selection.
- **Held-out evaluation dataset:** controlled examples not used for training, prompt tuning, or routine development feedback.
- **Safety evaluation dataset:** restricted examples used to evaluate policy compliance and robustness.
- **Partner-supplied dataset:** quarantined until rights, licence, provenance, privacy, quality, and restrictions are reviewed.

Never move held-out evaluation examples into training. If evaluation material is exposed to training or tuning, retire the affected portion from the held-out set and record the contamination.

## 5. Required record for every dataset contribution

Each contribution must include:
- Unique contribution and dataset-version IDs.
- Contributor or organisation identity, recorded securely.
- Creation or collection date and responsible reviewer.
- Source and provenance description.
- Whether the content is original, licensed, public-domain, synthetic, or otherwise sourced.
- Licence, permission, consent, and permitted-use evidence.
- Copyright, privacy, confidentiality, attribution, retention, and redistribution restrictions.
- Intended split: training, validation, held-out evaluation, or safety evaluation.
- Subject/domain, language, format, and approximate size.
- Quality-review status, duplicate status, and safety-review status.
- Hashes or other integrity identifiers for the accepted files.

Missing rights or provenance information means **quarantine, not acceptance**.

## 6. Data quality and safety gates

Before acceptance:
1. Verify provenance and permitted use.
2. Remove secrets and unnecessary personal information; apply privacy review where personal data may be present.
3. Check for malware and unsafe file formats.
4. Detect exact and near duplicates across all splits.
5. Review factual accuracy, answer quality, clarity, diversity, and language quality.
6. Identify harmful, abusive, manipulative, or otherwise high-risk material and apply documented handling rules.
7. Check for benchmark leakage and contamination.
8. Record reviewer decisions and reasons.

Synthetic data must be labelled as synthetic, with the generating system and method recorded where known. Synthetic examples must not be represented as human-authored.

## 7. Partner onboarding sequence

1. Define the proposed role and expected contribution.
2. Conduct identity, capability, conflict-of-interest, and security review appropriate to the access requested.
3. Agree on scope, deliverables, confidentiality, IP/background-IP treatment, data rights, publication rights, attribution, and termination.
4. Obtain written approval before sharing non-public materials or granting access.
5. Provide the minimum required access and onboarding guidance.
6. Review deliverables and provenance before accepting them.
7. Revoke access when the task ends and preserve the audit record.

No outreach, invitation, agreement, or account access is created by this plan alone.

## 8. Dataset release and version control

Every dataset release must have:
- Immutable version identifier and date.
- Dataset manifest and file hashes.
- Source/licence register.
- Inclusion and exclusion criteria.
- Split definitions and contamination checks.
- Quality and safety review summary.
- Known limitations and change log.
- Approval record.

Do not publish raw contributor data, private annotations, personal information, partner-confidential materials, or restricted evaluation answers. Public dataset cards must describe only what can lawfully and safely be disclosed.

## 9. Initial practical scope

Start with a small, auditable, original dataset rather than attempting to collect a massive corpus immediately. Prioritise:
- General conversation and instruction following.
- Explanation, summarisation, and writing.
- Arithmetic and structured reasoning with verified answers.
- Programming examples with executable or independently reviewed tests.
- Multilingual examples, including languages relevant to intended users, reviewed by competent speakers.
- Safety and refusal examples with clear expected behaviour.

Create a separate held-out evaluation set before expanding training data. Keep it access-controlled.

## 10. Approval gates

The project owner must explicitly approve:
- Any paid dataset, compute, API, contractor, or institutional service.
- Any licence that restricts future model distribution or commercial use.
- Any transfer or licence of LUXORA intellectual property.
- Any external access to private repositories, checkpoints, or non-public datasets.
- Any publication or public claim about model performance or partnerships.
- Any use of personal, sensitive, confidential, or regulated data.

Until approval is recorded, the default is no purchase, no external data transfer, no public partnership claim, and no grant of privileged access.

## 11. Current status

This plan establishes internal rules only. It does not mean LUXORA has signed partners, secured datasets, received institutional support, or trained LUXORA Core. All such milestones require separate evidence and approval.
