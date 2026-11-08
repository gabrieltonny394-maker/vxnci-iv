# LUXORA Core — Benchmark and Efficiency Specification

**Owner:** LUXORA CLUB  
**AI technology division:** LUXORA INTELLIGENCE  
**User-facing platform:** LUXORA AI  
**Model:** LUXORA Core  
**Development branch:** `develop/vxnci-foundation`  
**Status:** Version 1.0 — engineering specification; targets are proposed acceptance gates, not measured results.

This specification converts the approved Core capability roadmap into repeatable benchmarks and implementation requirements. It does not claim that the model, caching system, multimodal pipeline, or edge runtime already exists.

## 1. Objectives and non-goals

### Objectives
1. Deliver a useful, general-purpose assistant experience across conversation, instruction following, writing, reasoning, mathematics, coding, and supported languages.
2. Make long-context support useful, not merely syntactically large: retrieve and reason over information distributed throughout supplied context.
3. Reduce repeated inference work through correctly scoped caching, while measuring real end-to-end savings.
4. Provide a secure ingestion path for text, documents, and images, with a staged path to audio and video.
5. Route tasks to local or cloud execution only when the selected path can meet quality, privacy, latency, and resource requirements.
6. Establish reproducible baselines so every optimization can be compared against an unchanged control.

### Non-goals for the first milestone
- Claiming parity with OpenAI, Anthropic, or Google models.
- Promising a 75% cost reduction before measurement.
- Claiming a 200k reliable context window before it passes the full evaluation suite.
- Requiring one monolithic neural checkpoint to perform parsing, OCR, search, tool orchestration, and every modality.
- Shipping an on-device model before supported devices, memory, battery, latency, and quality have been measured.

## 2. System boundaries

The complete assistant is composed of distinct systems. Benchmark and report them separately, then measure the integrated experience.

| Layer | Responsibility | Examples |
|---|---|---|
| Core model | Learned language and reasoning behavior | Conversation, instruction following, writing, coding, maths |
| Inference runtime | Executes model computation | Token generation, attention/KV state, batching, quantization |
| Context service | Builds and manages working context | Conversation state, document chunks, retrieval |
| Cache service | Reuses eligible computation or derived artifacts | Prefix/prompt cache, session state, parsed-file cache |
| Ingestion services | Convert user inputs into model-ready representations | PDF/DOCX parsing, OCR, image preprocessing |
| Orchestration | Connects tools and controls permissions | Search, tools, browser workflows, confirmations |
| Edge runtime | Runs suitable operations locally | Formatting, deterministic transformations, optional small model |

A product feature is not evidence of a native model capability. Every test report must identify whether the tested behavior came from Core weights, runtime, a connected service, or a combination.

## 3. Benchmark protocol

### 3.1 Reproducibility record

Every benchmark run must record:
- Model/checkpoint identifier and cryptographic hash.
- Tokenizer and version.
- Runtime, inference engine, quantization, and configuration.
- Hardware type, memory, accelerator, and software versions.
- Dataset name, version, licence/provenance, split, and hash.
- Prompt template, system instructions, decoding settings, and tool configuration.
- Number of examples, scoring method, failures, and exclusions.
- Warm-up policy, concurrency, input/output token counts, and cache state.
- Median and p95 latency; throughput; peak memory; and cost estimate with its assumptions.

Never compare runs with materially different test conditions without clearly labelling the difference. Keep a fixed holdout set that is not used for training, prompt tuning, or cache priming.

### 3.2 Benchmark groups

| Group | Required measurements |
|---|---|
| Conversation | Multi-turn task success, context retention, contradiction handling, instruction adherence |
| General knowledge | Exactness, factuality, abstention/calibration, unsupported-claim rate |
| Reasoning | Multi-step accuracy, constraint satisfaction, answer consistency |
| Mathematics | Exact-answer accuracy by difficulty; calculation/tool use reported separately |
| Coding | Unit-test pass rate, bug-fix success, explanation correctness, regression rate |
| Writing | Rubric-based quality, requested tone/format adherence, edit preservation |
| Multilingual | Translation adequacy, comprehension, instruction following by language |
| Summarization | Source faithfulness, key-fact coverage, unsupported additions |
| Safety and security | Policy compliance, privacy leakage, prompt-injection resistance, safe tool behavior |
| Runtime | Time to first token, tokens/sec, p50/p95 end-to-end latency, throughput, memory |
| Efficiency | Cost per successful task, input/output compute, cache hit rate, cache overhead |
| Multimodal | Task accuracy by input type and ingestion path |

Publish both aggregate scores and per-category results. A single overall score must not conceal a severe weakness in a category.

## 4. Long-context evaluation

### 4.1 Release milestones

- **Milestone LC-1:** reliable 32k context baseline.
- **Milestone LC-2:** 100k context target for the first long-context release.
- **Milestone LC-3:** 200k context stretch target after LC-2 is stable.

These are target input-context sizes, not guaranteed usable capacities. Account for system instructions, conversation history, retrieved material, and output budget when calculating the actual available user context.

### 4.2 Test families

1. Single-fact retrieval at randomized positions: beginning, 10%, 25%, 50%, 75%, 90%, and end.
2. Multiple-fact retrieval with facts spread across the full input.
3. Multi-hop questions requiring joining evidence from distant sections.
4. Distractor-heavy tests with similar names, dates, identifiers, and plausible but irrelevant facts.
5. Conflicting-source tests requiring the model to identify disagreement and cite the relevant passages.
6. Long-document summarization with coverage and faithfulness scoring.
7. Codebase tasks requiring cross-file symbol, dependency, and behavior analysis.
8. Position-bias tests using equivalent prompts with evidence moved to different locations.
9. Truncation and overflow tests to verify transparent handling rather than silent loss.
10. Repeated-turn tests where earlier context must be used accurately after many follow-up turns.

### 4.3 Provisional acceptance gates

The following are proposed engineering gates and must be validated against the chosen benchmark set before they become a public performance claim:

| Gate | Proposed threshold |
|---|---:|
| LC-1 32k single-needle exact retrieval | >= 95% |
| LC-2 100k single-needle exact retrieval | >= 90% |
| LC-2 100k multi-needle exact retrieval | >= 85% |
| LC-2 100k multi-hop task success | >= 75% |
| Position consistency | No position band more than 10 percentage points below the overall score |
| Evidence-grounded answer rate | >= 95% on tasks explicitly requiring evidence |
| Silent truncation | 0 occurrences in tested overflow cases |

Report confidence intervals and sample counts. If a threshold is not met, label the milestone failed or partial; do not lower the threshold after seeing results without recording a specification revision. LC-3 uses the same test families at 200k and receives its own explicit release decision.

## 5. Context management and retrieval

The context service should:
- Preserve conversation turns with explicit token budgeting and configurable retention.
- Parse documents into stable, traceable segments while preserving page, heading, line, and source metadata where possible.
- Support lexical and semantic retrieval; combine them where evaluation demonstrates an improvement.
- Rerank candidate passages and retain source references for grounded responses.
- Deduplicate overlapping chunks and avoid flooding the prompt with redundant evidence.
- Distinguish user instructions, source content, and untrusted retrieved text.
- Treat instructions found inside uploaded documents or retrieved web pages as untrusted data, not system instructions.
- Report when source material is incomplete, unsupported, malformed, or too large.

Retrieval evaluation must include Recall@k, precision, ranking quality, answer faithfulness, and end-to-end task success. Retrieval scores alone do not prove that the model used the evidence correctly.

## 6. Caching architecture

Caching is a measured optimization, not a correctness shortcut. Implement cache layers independently, with explicit keys, scopes, expiry, invalidation, and observability.

### 6.1 Layer A — inference prefix / prompt cache

Purpose: reuse eligible computation for identical prompt prefixes when the inference engine supports it.

Requirements:
- Cache keys must include model/checkpoint hash, tokenizer version, relevant runtime settings, and an exact prefix identity.
- Only exact compatible prefixes may reuse computed state; do not assume semantically similar prompts are interchangeable.
- Keep stable system/developer instructions and reusable static prompt prefixes before variable user content where the runtime's caching rules benefit from this ordering.
- Record prefix tokens eligible, cache hits, misses, evictions, and actual compute saved.
- Cache behavior must never change the answer relative to an uncached control beyond normal nondeterministic decoding variance.

### 6.2 Layer B — session and conversation state

Purpose: avoid repeatedly reconstructing reusable session context.

Requirements:
- Scope state to the authenticated user and conversation/session.
- Enforce access isolation; no cross-user cache reuse for private conversation content.
- Define retention and deletion behavior, including user deletion requests and session expiry.
- Invalidate or version state when conversation history, system instructions, tools, or model configuration changes.
- Do not treat cached conversation state as durable memory unless the user-facing product explicitly supports and governs that behavior.

### 6.3 Layer C — document and retrieval artifacts

Purpose: reuse expensive parsing, OCR, embeddings, indexes, and retrieval artifacts for unchanged files.

Requirements:
- Key artifacts by content hash, parser/OCR version, embedding model/version, chunking configuration, and relevant access scope.
- Recheck authorization before serving any cached artifact.
- Invalidate when source content, parser version, embedding model, or permissions change.
- Preserve source/page/line metadata through retrieval.
- Avoid retaining sensitive document content longer than the configured policy permits.

### 6.4 Cache safety and correctness tests

- Cross-user and cross-tenant isolation tests.
- Cache-key collision and version-mismatch tests.
- Expiry, invalidation, deletion, and revocation tests.
- Prompt-injection persistence tests: untrusted document instructions must not become trusted cached instructions.
- Cached-versus-uncached output and task-success comparisons.
- Cold-start, warm-cache, and mixed-workload tests.
- Memory pressure, eviction, and cache stampede tests.

### 6.5 Cost measurement and 75% stretch target

A 75% saving is a stretch goal for selected repetitive workloads, not a general guarantee. Measure:
- Baseline cost per request and per successful task without caching.
- Cached cost per request and per successful task.
- Cache hit rate and eligible-prefix token ratio.
- Storage, indexing, retrieval, and cache-management overhead.
- Latency impact and quality/regression impact.

Use the same workload, model, output limits, concurrency, and hardware for paired cached/uncached runs. Report savings as:

`saving = 1 - (cached total cost / uncached total cost)`

Calculate this for each workload and for the aggregate workload. Separate provider-billed cost from internal compute, storage, and operational cost. Do not claim 75% savings unless the measured result supports it for a clearly described workload.

## 7. Multimodal ingestion roadmap

Use a modular ingestion pipeline with a common security and provenance contract.

### Phase M1 — text and code
- UTF-8 text, Markdown, source code, and structured text.
- Preserve file names, encoding, line numbers, and source boundaries.
- Apply size limits, malware scanning where available, and safe decoding.

### Phase M2 — office and PDF documents
- PDF, DOCX, and other explicitly supported office formats.
- Extract text, headings, tables, page boundaries, and metadata.
- Detect scanned pages and route them to OCR.
- Preserve page references so answers can point back to source locations.
- Test malformed files, encrypted files, huge files, tables, columns, and mixed layouts.

### Phase M3 — images
- Common image formats with size and dimension limits.
- Image decoding, orientation correction, resizing/tiling as required by the vision path.
- OCR for text-heavy images, with confidence and uncertainty retained.
- Vision-language question answering evaluated separately from OCR extraction.
- Strip or govern metadata that could expose private information.

### Phase M4 — audio (future)
- Explicitly scoped audio upload or live audio.
- Speech recognition, timestamps, speaker handling where justified, and audio understanding.
- Evaluate word error rate and task success separately.

### Phase M5 — video (future)
- Controlled frame sampling, timestamps, optional audio transcription, and temporal summarization.
- Evaluate event ordering and missed-event rates; do not infer unseen frames.

For every modality, test parser failures, prompt injection embedded in content, access controls, file deletion, resource exhaustion, and correct attribution to the source. Do not advertise a modality until the integrated pipeline and model path pass their tests.

## 8. Edge and cloud routing

### 8.1 Initial routing policy

| Task class | Initial route | Fallback |
|---|---|---|
| Deterministic formatting and simple transformations | On-device deterministic code | Cloud only if ambiguous or unsupported |
| Basic text cleanup and styling | On-device rules or optional small local model | Cloud |
| Large-context reasoning and coding | Cloud inference | Clear error/retry path |
| Large document or codebase analysis | Cloud retrieval and inference | Explain unsupported/oversized input |
| Advanced image understanding | Cloud vision path initially | Explicit unsupported response |
| Sensitive content | Prefer local processing when it can meet quality requirements | Ask/obey user consent before remote processing where required |

Do not route sensitive user content to a cloud service without the product's disclosed processing behavior and applicable consent. Do not silently upload local files.

### 8.2 Routing contract

Every route decision should consider:
- Task type and required capability.
- Local model/runtime availability and version.
- Device memory, thermal state, battery constraints, and estimated latency.
- Data sensitivity and user settings.
- Context size and modality.
- Confidence/quality thresholds established through evaluation.
- Network availability and cloud cost policy.

The router must support explicit fallback, cancellation, and transparent status. It must not claim a local task was completed if it was actually sent to the cloud.

### 8.3 Edge acceptance tests

Measure on a declared device matrix:
- Install size and peak memory.
- Cold and warm latency.
- Battery and thermal impact over repeated workloads.
- Output quality against the cloud/reference path.
- Offline behavior and safe failure.
- Cloud escalation rate and user-visible disclosure.
- Privacy and network-egress behavior.

Begin with deterministic local transformations. Add a local language model only after device feasibility and quality justify it.

## 9. Latency and efficiency targets

Do not set absolute millisecond or tokens-per-second targets until the first supported hardware and runtime are selected. First capture a baseline. Then define service-level targets by hardware class and workload.

Required metrics:
- Time to first token (TTFT), p50 and p95.
- Decode tokens per second, p50 and p95.
- End-to-end task latency, p50 and p95.
- Concurrent request throughput.
- Peak accelerator and host memory.
- Energy/battery impact for edge workloads.
- Cost per 1,000 input tokens, output tokens, request, and successful task where applicable.
- Failure, timeout, cancellation, and retry rates.

Optimizations such as quantization, batching, speculative decoding, or attention-kernel changes must be benchmarked for both quality and efficiency. Keep an unoptimized reference configuration for regression comparisons.

## 10. Security, privacy, and governance

- Treat uploaded files, retrieved web pages, tool outputs, and cache contents as untrusted input.
- Enforce tenant/user authorization before cache lookup and before returning any artifact.
- Keep secrets and provider credentials server-side; never embed them in client apps or model prompts.
- Log minimal operational metadata; do not log full private prompts or documents by default.
- Define retention, deletion, backup, and incident-response policies before production use.
- Prevent cross-user data leakage through prompts, retrieval indexes, caches, logs, and debugging tools.
- Require explicit confirmation for consequential external actions.
- Record dataset provenance and licences for model training separately from user-uploaded runtime content.
- Do not train on private user content without a separate informed opt-in and governance approval.

## 11. Release gates and definition of done

### Gate 0 — benchmark harness
- Versioned test cases and scoring scripts exist.
- A fixed holdout set is established.
- Test provenance and licences are documented.
- A baseline can be run and results exported reproducibly.

### Gate 1 — Core assistant baseline
- Conversation, instruction following, writing, reasoning, maths, and coding are measured.
- Known weaknesses and unsupported tasks are documented.
- No external-model parity claim is made without equivalent independent evaluation.

### Gate 2 — long context
- 32k gate passes before 100k release evaluation.
- 100k tests pass the approved thresholds before describing 100k as reliable.
- 200k remains experimental until its separate gate passes.

### Gate 3 — caching
- Each cache layer has isolated correctness, privacy, expiry, and invalidation tests.
- Cached and uncached workloads are compared.
- Cost and latency savings are reported with methodology and overhead.

### Gate 4 — multimodal
- Each supported input type passes ingestion, security, provenance, and task-quality tests.
- OCR extraction and image reasoning are reported separately.
- Unsupported formats fail clearly and safely.

### Gate 5 — edge/cloud
- Local and cloud routes are observable and accurately disclosed.
- Edge quality, device impact, offline behavior, and escalation are measured.
- Sensitive data handling passes review.

### Gate 6 — release readiness
- No unresolved critical privacy/security issue.
- Regression suite passes on the release candidate.
- Model, tokenizer, runtime, ingestion, and benchmark versions are recorded.
- Limitations, supported formats, context limits, and service behavior are documented.
- Cost and compute fit explicitly approved resource limits.

## 12. Implementation sequence

1. Inspect the existing AI core, test setup, and repository conventions; do not duplicate existing modules.
2. Add a benchmark harness and small deterministic tests before model-scale experiments.
3. Establish a reproducible uncached baseline on available, approved hardware.
4. Implement context budgeting and retrieval evaluation.
5. Add one cache layer at a time, starting with exact prefix caching only if the selected inference runtime supports it.
6. Add document ingestion and source-grounded evaluation.
7. Add image ingestion and vision evaluation.
8. Prototype deterministic on-device formatting and routing.
9. Evaluate a local model only after device/runtime feasibility is documented.
10. Advance to 100k and then 200k context only when quality and compute results justify it.

## 13. Resource and approval controls

This is a free-first research plan. No paid GPU, API, cloud hosting, subscription, dataset licence, or other paid service may be activated without explicit user approval. Do not start a long-running job when compute limits, data rights, storage, or cost are unknown. Use small bounded experiments and record stop conditions.

## 14. Change control

Any change to a target, threshold, supported modality, context size, or cost claim must:
1. Update this specification with a version/date and rationale.
2. Preserve prior benchmark results for comparison.
3. Identify which release gates are affected.
4. Be reviewed before public capability claims change.

**Current truth:** this file defines what LUXORA Core should be tested against. It does not prove that any target has been achieved. No model performance, 75% savings, 100k/200k reliability, or edge capability may be claimed until demonstrated by recorded tests.
