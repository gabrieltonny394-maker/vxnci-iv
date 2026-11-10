import { describe, expect, it } from "vitest";
import {
  prepareConversationContext,
  type ConversationStore,
  type ConversationSummary,
  type StoredConversationMessage,
} from "./context-continuity";

function fixture() {
  const messages: StoredConversationMessage[] = Array.from({ length: 12 }, (_, index) => ({
    id: `m${index + 1}`,
    conversationId: "chat-1",
    ownerId: "user-1",
    sequence: index + 1,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message ${index + 1} ${"detail ".repeat(8)}`,
    createdAt: new Date(index * 1000).toISOString(),
  }));
  let saved: ConversationSummary | null = null;
  const store: ConversationStore = {
    async listMessages({ ownerId, conversationId }) {
      return messages.filter((m) => m.ownerId === ownerId && m.conversationId === conversationId);
    },
    async getLatestSummary({ ownerId, conversationId }) {
      return saved?.ownerId === ownerId && saved.conversationId === conversationId ? saved : null;
    },
    async saveSummary(summary) { saved = summary; },
  };
  return { messages, store, getSaved: () => saved };
}
const summarizer = {
  id: "test-summarizer",
  async summarize({ messages }: { messages: StoredConversationMessage[] }) {
    return `Covered ${messages[0].sequence}-${messages[messages.length - 1].sequence}; preserve project goal and pending action.`;
  },
};

describe("conversation continuity", () => {
  it("compacts older turns while keeping recent turns and system instructions", async () => {
    const f = fixture();
    const result = await prepareConversationContext({
      ownerId: "user-1", conversationId: "chat-1",
      instructions: [{ role: "system", content: "Never drop this instruction." }],
      currentMessage: { role: "user", content: "continue" },
      budget: { contextLimit: 240, maxOutputTokens: 40, safetyMarginTokens: 10, recentMessageCount: 2 },
      store: f.store, summarizer,
      countTokens: (text) => Math.ceil(text.length / 4),
    });
    expect(result.state).toBe("READY_TO_CONTINUE");
    expect(result.messages[0].content).toContain("Never drop");
    expect(result.messages.some((m) => m.content.includes("Continuation summary"))).toBe(true);
    expect(result.messages.at(-1)?.content).toBe("continue");
    expect(result.summaryVersion).toBe(1);
  });

  it("never mutates or deletes original messages", async () => {
    const f = fixture();
    const before = JSON.stringify(f.messages);
    await prepareConversationContext({
      ownerId: "user-1", conversationId: "chat-1",
      instructions: [], currentMessage: { role: "user", content: "next" },
      budget: { contextLimit: 240, maxOutputTokens: 40, safetyMarginTokens: 10, recentMessageCount: 2 },
      store: f.store, summarizer, countTokens: (text) => Math.ceil(text.length / 4),
    });
    expect(JSON.stringify(f.messages)).toBe(before);
    expect(f.messages).toHaveLength(12);
  });

  it("does not mark a summary ready when persistence fails", async () => {
    const f = fixture();
    f.store.saveSummary = async () => { throw new Error("disk unavailable"); };
    await expect(prepareConversationContext({
      ownerId: "user-1", conversationId: "chat-1",
      instructions: [], currentMessage: { role: "user", content: "next" },
      budget: { contextLimit: 240, maxOutputTokens: 40, safetyMarginTokens: 10, recentMessageCount: 2 },
      store: f.store, summarizer, countTokens: (text) => Math.ceil(text.length / 4),
    })).rejects.toMatchObject({ code: "SUMMARY_FAILED" });
  });

  it("scopes summaries and history by owner and conversation", async () => {
    const f = fixture();
    const result = await prepareConversationContext({
      ownerId: "different-user", conversationId: "chat-1",
      instructions: [], currentMessage: { role: "user", content: "private" },
      budget: { contextLimit: 512, maxOutputTokens: 64 },
      store: f.store, summarizer,
    });
    expect(result.messages).toEqual([{ role: "user", content: "private" }]);
    expect(result.summaryVersion).toBeNull();
  });

  it("reserves output and safety margin", async () => {
    const f = fixture();
    await expect(prepareConversationContext({
      ownerId: "user-1", conversationId: "chat-1",
      instructions: [], currentMessage: { role: "user", content: "x" },
      budget: { contextLimit: 20, maxOutputTokens: 18, safetyMarginTokens: 5 },
      store: f.store, summarizer,
    })).rejects.toMatchObject({ code: "CONTEXT_TOO_SMALL" });
  });
});
