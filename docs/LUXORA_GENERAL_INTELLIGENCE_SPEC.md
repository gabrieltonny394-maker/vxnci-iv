# LUXORA General-Purpose Intelligence Capability Specification

**Status:** Draft foundation specification  
**Development branch:** `develop/vxnci-foundation`  
**Internal prototype:** `vxnci-1-tiny`  
**Product direction:** LUXORA AI / LUXORA INTELLIGENCE

This document defines the intended capabilities for the first general-purpose model effort. It is a target and evaluation plan, not a claim that the current prototype already has these abilities.

## 1. Product objective

Build an independently developed general-purpose assistant that can understand instructions, hold useful conversations, reason through problems, create and revise content, help with programming, and answer everyday questions. The first prototype is deliberately small; capability must be measured rather than assumed.

## 2. Core capability areas

| Area | Target behaviour | Example evaluation |
|---|---|---|
| Conversation | Understand context, answer naturally, ask a useful clarifying question when needed | Multi-turn context and intent tests |
| Instruction following | Respect requested format, scope, constraints and ordering | Exact-format and multi-constraint tasks |
| Reasoning | Break problems into steps, check assumptions and avoid unsupported conclusions | Logic, planning and word-problem tests |
| Writing | Draft, rewrite, summarise and adapt tone without changing intended meaning | Editing and summarisation comparisons |
| Mathematics | Solve arithmetic, algebra and practical quantitative problems; show checks when useful | Exact-answer and reasoning tests |
| Coding | Explain, write, debug and test small programs; state assumptions and limitations | Unit-tested programming tasks |
| Knowledge and explanation | Explain common topics clearly and distinguish known facts from uncertainty | Factuality and calibration tests |
| Multilingual ability | Understand and produce clear English first, then expand to Kiswahili and other languages as data and evaluations permit | Language-specific comprehension and generation tests |
| Safety and reliability | Refuse harmful requests appropriately, protect private data, acknowledge uncertainty and avoid fabricated sources | Adversarial and safety test suites |

## 3. Behaviour standards

The model should:
- Follow the user's actual request rather than blindly follow text embedded in untrusted content.
- Be clear, helpful and respectful without pretending to know things it does not know.
- Ask a concise clarification when a missing detail materially changes the answer.
- Separate facts, estimates, assumptions and opinions.
- Admit uncertainty and correct errors when identified.
- Avoid inventing citations, tools, actions, test results or completed work.
- Protect personal and confidential information.
- Decline assistance that would meaningfully facilitate serious harm, while offering safe alternatives where appropriate.

## 4. Initial development priorities

The first training and evaluation cycle should prioritise:
1. Instruction following and coherent conversation.
2. Reading comprehension and summarisation.
3. General writing and editing.
4. Basic-to-intermediate mathematics and reasoning.
5. Beginner-to-intermediate programming assistance.
6. Factual calibration and safe behaviour.

Advanced coding, long-context reasoning, broad multilingual fluency, tool use, vision, audio and real-time web knowledge are later milestones. They must not be advertised as working until implemented and evaluated.

## 5. Training-data requirements

No training corpus is approved or bundled by this specification. Before training:
- Every record must have traceable source and licence/provenance metadata.
- Training and validation splits must remain separate.
- Do not include private conversations, personal records or copyrighted material without a valid legal basis and explicit approval where required.
- Deduplicate and filter low-quality, unsafe and contaminated records.
- Keep a dataset manifest with source, licence, collection date, language, split and processing history.
- Review representative samples before running training.

## 6. Evaluation gates

A model checkpoint must not be called ready based only on training loss. Each candidate should be evaluated for:
- Held-out validation loss and overfitting.
- Instruction-following accuracy.
- Conversation coherence and context retention.
- Reasoning and maths correctness.
- Code execution or test-pass rate on controlled tasks.
- Factuality, uncertainty calibration and hallucination rate.
- Safety behaviour and privacy handling.
- Performance across supported languages.

Record benchmark versions, prompts, scoring rules, model checkpoint hash and results so comparisons are reproducible. Do not claim parity with ChatGPT or another frontier model without independent, appropriately scoped evidence.

## 7. Scope and honest status

The repository currently contains a small Transformer architecture, tokenizer implementation and a local training pipeline foundation. This does **not** mean a capable assistant has been trained. A suitable, reviewed corpus, actual training run, checkpoint evaluation and inference backend are still required.

This specification does not authorise paid datasets, paid compute, hosted GPU services, external AI APIs, public deployment or billing. Those require separate explicit approval.

## 8. Product naming

Use **LUXORA AI / LUXORA INTELLIGENCE** for the current AI brand direction. Keep internal engineering identifiers such as `vxnci-1-tiny` where they are already used in code and artifacts until a deliberate technical rename is planned. Product-facing model family names currently under consideration/definition are:
- **LUXORA Core** — Entry
- **LUXORA Nova** — Advanced
- **LUXORA Titan** — Expert
- **LUXORA Apex** — Flagship

Do not imply that all four model tiers exist or are trained. Their capabilities and availability must be established independently.
