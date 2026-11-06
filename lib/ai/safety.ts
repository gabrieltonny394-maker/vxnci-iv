import type { ChatMessage } from "./contracts";

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 40_000;

export class InvalidChatRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChatRequestError";
  }
}

export function validateChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    throw new InvalidChatRequestError("Provide between 1 and 30 messages.");
  }

  let totalChars = 0;
  const messages = value.map((item): ChatMessage => {
    if (!item || typeof item !== "object") {
      throw new InvalidChatRequestError("Each message must be an object.");
    }

    const candidate = item as Record<string, unknown>;
    if (candidate.role !== "user" && candidate.role !== "assistant") {
      throw new InvalidChatRequestError("Message role is not supported.");
    }
    if (typeof candidate.content !== "string" || !candidate.content.trim()) {
      throw new InvalidChatRequestError("Message content cannot be empty.");
    }
    if (candidate.content.length > MAX_MESSAGE_CHARS) {
      throw new InvalidChatRequestError("A message is too long.");
    }

    totalChars += candidate.content.length;
    return { role: candidate.role, content: candidate.content.trim() };
  });

  if (totalChars > MAX_TOTAL_CHARS) {
    throw new InvalidChatRequestError("The conversation is too long.");
  }

  if (messages[messages.length - 1]?.role !== "user") {
    throw new InvalidChatRequestError("The latest message must be from the user.");
  }

  return messages;
}
