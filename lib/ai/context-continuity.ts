import type { ChatMessage } from "../contracts";

export type ConversationRole = ChatMessage["role"];
export interface StoredConversationMessage extends ChatMessage {
  id: string;
  conversationId: string;
  ownerId: string;
  sequence: number;
  createdAt: string;
}
export interface ConversationSummary {
  id: string;
  conversationId: string;
  ownerId: string;
  version: number;
  coveredThroughSequence: number;
  content: string;
  createdAt: string;
  summarizerId: string;
}
export interface ConversationStore {
  listMessages(input: { ownerId: string; conversationId: string }): Promise<StoredConversationMessage[]>;
  getLatestSummary(input: { ownerId: string; conversationId: string }): Promise<ConversationSummary | null>;
  saveSummary(summary: ConversationSummary): Promise<void>;
}
export interface ContinuationSummarizer {
  readonly id: string;
  summarize(input: {
    previousSummary: string | null;
    messages: StoredConversationMessage[];
  }): Promise<string>;
}
export type ContextState = "NORMAL" | "APPROACHING_LIMIT" | "SUMMARIZING" | "READY_TO_CONTINUE" | "RECOVERY_REQUIRED";
export interface ContextBudget {
  contextLimit: number;
  maxOutputTokens: number;
  safetyMarginTokens?: number;
  warningAtRatio?: number;
  recentMessageCount?: number;
}
export interface PreparedConversationContext {
  messages: ChatMessage[];
  state: ContextState;
  estimatedInputTokens: number;
  contextLimit: number;
  compacted: boolean;
  summaryVersion: number | null;
}
export class ContextContinuityError extends Error {
  constructor(message: string, readonly code: "HISTORY_UNAVAILABLE" | "SUMMARY_FAILED" | "CONTEXT_TOO_SMALL") {
    super(message);
    this.name = "ContextContinuityError";
  }
}

/** Conservative fallback only. Production adapters should inject the selected model tokenizer. */
export function estimateTokens(text: string): number {
  return Math.ceil(new TextEncoder().encode(text).length / 3);
}
function countMessages(messages: ChatMessage[], count: (text: string) => number): number {
  return messages.reduce((total, message) => total + 4 + count(message.content), 2);
}
function asChatMessages(messages: StoredConversationMessage[]): ChatMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

/**
 * Builds a bounded model prompt without ever modifying or deleting original messages.
 * Summary persistence is completed before the returned context can use that summary.
 */
export async function prepareConversationContext(input: {
  ownerId: string;
  conversationId: string;
  instructions: ChatMessage[];
  currentMessage: ChatMessage;
  budget: ContextBudget;
  store: ConversationStore;
  summarizer: ContinuationSummarizer;
  countTokens?: (text: string) => number;
}): Promise<PreparedConversationContext> {
  const {
    ownerId, conversationId, instructions, currentMessage, budget, store, summarizer,
  } = input;
  const count = input.countTokens ?? estimateTokens;
  const safety = budget.safetyMarginTokens ?? Math.ceil(budget.contextLimit * 0.08);
  const available = budget.contextLimit - budget.maxOutputTokens - safety;
  if (available < 1 || budget.maxOutputTokens < 1 || budget.contextLimit < 1) {
    throw new ContextContinuityError("The configured context budget cannot fit the reserved output and safety margin.", "CONTEXT_TOO_SMALL");
  }

  let history: StoredConversationMessage[];
  let summary: ConversationSummary | null;
  try {
    [history, summary] = await Promise.all([
      store.listMessages({ ownerId, conversationId }),
      store.getLatestSummary({ ownerId, conversationId }),
    ]);
  } catch {
    throw new ContextContinuityError("Conversation history is temporarily unavailable. Original messages have not been changed.", "HISTORY_UNAVAILABLE");
  }
  history = [...history].sort((a, b) => a.sequence - b.sequence);
  const covered = summary?.coveredThroughSequence ?? 0;
  const uncovered = history.filter((message) => message.sequence > covered);
  const recentCount = Math.max(2, budget.recentMessageCount ?? 8);
  const fullHistory = asChatMessages(uncovered);
  const recent = uncovered.slice(-recentCount);
  const older = uncovered.slice(0, Math.max(0, uncovered.length - recent.length));
  const summaryMessage = (): ChatMessage[] => summary
    ? [{ role: "system", content: "Continuation summary of earlier conversation turns (derived context, not user-authored):\\n" + summary.content }]
    : [];
  const total = (messages: ChatMessage[]) => countMessages(messages, count);
  const fullPrompt = [...instructions, ...summaryMessage(), ...fullHistory, currentMessage];
  const fullTokens = total(fullPrompt);
  const warningAt = budget.warningAtRatio ?? 0.75;
  if (fullTokens <= available) {
    return {
      messages: fullPrompt,
      state: fullTokens / available >= warningAt ? "APPROACHING_LIMIT" : "NORMAL",
      estimatedInputTokens: fullTokens,
      contextLimit: budget.contextLimit,
      compacted: Boolean(summary),
      summaryVersion: summary?.version ?? null,
    };
  }

  const build = (): ChatMessage[] => [
    ...instructions,
    ...summaryMessage(),
    ...asChatMessages(recent),
    currentMessage,
  ];

  if (older.length === 0) {
    throw new ContextContinuityError("The recent conversation and required instructions exceed this model's available context. Original history is preserved.", "CONTEXT_TOO_SMALL");
  }

  const state: ContextState = "SUMMARIZING";
  let summaryText: string;
  try {
    summaryText = (await summarizer.summarize({
      previousSummary: summary?.content ?? null,
      messages: older,
    })).trim();
    if (!summaryText) throw new Error("Summarizer returned an empty summary.");
  } catch {
    throw new ContextContinuityError("Context refresh could not be completed. Your original conversation is safe; retry when ready.", "SUMMARY_FAILED");
  }

  const candidate: ConversationSummary = {
    id: `${conversationId}:summary:${(summary?.version ?? 0) + 1}`,
    conversationId,
    ownerId,
    version: (summary?.version ?? 0) + 1,
    coveredThroughSequence: older[older.length - 1].sequence,
    content: summaryText,
    createdAt: new Date().toISOString(),
    summarizerId: summarizer.id,
  };
  try {
    await store.saveSummary(candidate);
  } catch {
    throw new ContextContinuityError("The refreshed context could not be saved. Your original conversation is safe; retry when ready.", "SUMMARY_FAILED");
  }

  summary = candidate;
  const messages = build();
  const estimatedInputTokens = total(messages);
  if (estimatedInputTokens > available) {
    throw new ContextContinuityError("The compacted context still exceeds this model's available budget. Original history remains preserved.", "CONTEXT_TOO_SMALL");
  }
  return {
    messages,
    state: "READY_TO_CONTINUE",
    estimatedInputTokens,
    contextLimit: budget.contextLimit,
    compacted: true,
    summaryVersion: summary.version,
  };
}
