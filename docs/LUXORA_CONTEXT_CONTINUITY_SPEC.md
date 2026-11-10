# LUXORA AI — Context Continuity and Conversation Compaction

**Status:** Product requirement / implementation specification  
**Product:** LUXORA AI / LUXORA INTELLIGENCE  
**Development branch:** `develop/vxnci-foundation`

## 1. Problem

A user must not lose the ability to continue a useful conversation merely because the model's active context window is full. A hard-stop screen that only offers a new chat or a paid upgrade is not an acceptable default experience.

The context window is a model/runtime limit, not a limit on how long a user may keep a conversation.

## 2. Required user experience

1. **Early context indicator.** Show an understandable estimate of context use (for example, Normal, Getting full, Preparing to continue). Do not expose false precision when token counts are estimates.
2. **Proactive compaction.** Before the configured context budget is exhausted, prepare a compact continuation state and retain a recent-message window.
3. **Seamless continuation.** Continue the same conversation after compaction. Do not force a new chat just to recover context.
4. **Preserve original history.** Compaction must never delete, overwrite or silently replace the user's original messages. The summary is an additional derived artifact.
5. **User-visible transparency.** Show a small notice such as “Conversation context refreshed — earlier messages are still in your chat history.”
6. **History recovery.** When an older detail is needed, retrieve the relevant original messages from persisted conversation history rather than assuming the summary contains every detail.
7. **No forced upgrade.** Do not make a paid upgrade the only recovery path when the active context budget is reached. Plans may have different model limits, but every plan should have graceful handling within its supported limits.
8. **Failure-safe behaviour.** If summary generation or persistence fails, do not discard messages. Pause safely and explain how the user can continue or retry.
9. **Respect deletion and privacy controls.** Deleting a conversation must also delete its derived summaries and indexes according to the product's retention policy. Never use one user's conversation data in another user's context.
10. **Honest capability claims.** The UI and API must distinguish the model's actual context limit from the amount of historical conversation retained by the product.

## 3. Context assembly policy

For each model request, construct the prompt from:
- System and developer instructions, always retained and never summarised away.
- The latest valid conversation summary, clearly marked as a summary of earlier turns and not as user-authored text.
- A bounded set of the most recent original messages, preserving role and order.
- Any specifically retrieved older messages that are relevant to the current request.
- The current user message.

Do not include both a summary and duplicate copies of the same older turns unless needed for grounding. Apply token budgeting to the complete assembled request, including instructions, tool results and reserved output tokens.

## 4. Compaction lifecycle

Use explicit states:
- `NORMAL`: enough budget remains for ordinary conversation.
- `APPROACHING_LIMIT`: warn and schedule compaction before the hard limit.
- `SUMMARIZING`: create/update continuation summary while preserving the source messages.
- `READY_TO_CONTINUE`: summary is saved and the next request can use it.
- `RECOVERY_REQUIRED`: summary or persistence failed; original history remains intact and retry is possible.

Compaction should be triggered by measured/estimated token budget, not by a fixed number of messages. Reserve a configurable safety margin for tokenizer mismatch, system instructions and output tokens. Do not wait until a request has already exceeded the model's maximum.

## 5. Summary quality contract

A continuation summary should preserve, where present:
- User's explicit goals and the current task.
- Stable preferences and constraints relevant to the active conversation.
- Decisions already made and rejected alternatives.
- Important named entities, values, dates and exact identifiers.
- Current project state, completed work and verified evidence.
- Open questions, blockers and the next agreed action.
- Safety, privacy and approval boundaries.

It must distinguish confirmed facts from assumptions, avoid inventing missing details, and carry forward uncertainty. It should be versioned and associated with the conversation and the source-message range it covers. The latest messages remain in the original-message window, not only in the summary.

## 6. Persistence and retrieval requirements

The production design requires durable conversation storage with:
- Conversation and message IDs, owner/user scope, role, content and timestamps.
- Immutable original message records (edits/deletions handled explicitly).
- Summary records with version, covered message range, creation time and model/version metadata.
- Optional retrieval index over older messages, strictly scoped to the owning user and conversation.
- Transactional writes or equivalent safeguards so a summary cannot be marked ready before it is durably stored.
- Retention, export and deletion behaviour consistent with user controls.

Do not use process memory or browser local storage as the sole source of truth for production conversation history. Do not silently add a hosted database or paid service; backend selection and any associated cost require explicit approval.

## 7. API and runtime contract

- The runtime must expose or internally calculate the effective context budget for the selected model.
- Prompt assembly must count all included tokens using the selected model's tokenizer where available.
- The model request must reserve the configured maximum output budget.
- When context is too large, the server should compact/retrieve and retry assembly before returning a context-length error.
- Return structured usage and context metadata where appropriate (for example, input tokens, output tokens, context limit, and whether compaction occurred). Do not expose private summary contents to unrelated clients.
- Keep API errors machine-readable and actionable. A context overflow should not be disguised as a generic server failure.
- If the selected model does not support enough context for the task even after compaction, explain the actual limitation honestly.

## 8. Evaluation and acceptance tests

The feature is not complete until automated tests demonstrate:
1. A long conversation continues in the same conversation after compaction.
2. Original messages remain unchanged and retrievable.
3. The summary retains key goals, constraints, decisions, identifiers and pending actions in a multi-turn test.
4. Recent messages retain their original order and roles.
5. System/developer instructions are never dropped during compaction.
6. Token budgeting reserves output capacity and a safety margin.
7. A failed summary write never causes message loss or a false ready state.
8. Two users' conversations and summaries cannot cross-contaminate.
9. Conversation deletion removes associated derived summaries/indexes as required.
10. Context usage and compaction notices are accurate and do not claim unlimited memory.
11. The system recovers gracefully when older-message retrieval is unavailable.
12. A model with a smaller context window still supports the same product continuity workflow within its actual limits.

## 9. Rollout sequence

1. Define storage interfaces and a model-independent token-budget contract.
2. Implement and test context assembly and summary lifecycle with a fake/test summarizer.
3. Add durable persistence only after an approved backend is selected.
4. Integrate the real summarization model/runtime and verify privacy boundaries.
5. Add the UI context indicator and transparent compaction notice.
6. Run long-conversation, failure, deletion, privacy-isolation and regression tests.
7. Release only after all acceptance tests pass.

## 10. Current implementation status

This document records the required product behaviour. It does not claim that automatic compaction, durable conversation history, retrieval, or a working model runtime is already implemented. The current chat interface and AI runtime are still foundation-stage. Implementation must be verified in code and CI before this feature is described as available.

No paid upgrade, hosted storage, external model API, paid inference service or public deployment is authorised by this specification.
