export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No AI model provider is configured. Connect a provider before sending live prompts.");
    this.name = "ProviderNotConfiguredError";
  }
}

/**
 * Provider contract:
 * generate({ conversationId, messages }) must return
 * { content: non-empty string, model: non-empty string }.
 *
 * The default provider deliberately fails closed. It never fabricates an
 * assistant answer when no real model is connected.
 */
export class UnconfiguredProvider {
  async generate() {
    throw new ProviderNotConfiguredError();
  }
}
