import { GeminiProvider } from "./gemini-provider.js";

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No AI model provider is configured. Connect a provider before sending live prompts.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class UnconfiguredProvider {
  constructor() {
    this.configured = false;
  }
  async generate() {
    throw new ProviderNotConfiguredError();
  }
}

export function createProviderFromEnv(env = process.env) {
  if (typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim()) {
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || "gemini-3.8-flash"
    });
  }
  return new UnconfiguredProvider();
}
