import type { ModelAdapter } from "../contracts";

export type ProviderKind = "local" | "self-hosted" | "external" | "test";

export interface ProviderRegistration {
  id: string;
  name: string;
  kind: ProviderKind;
  adapter: ModelAdapter;
}

export interface ProviderSummary {
  id: string;
  name: string;
  kind: ProviderKind;
  modelId: string;
}

export class ProviderRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRegistrationError";
  }
}

/**
 * Server-side registry for model providers owned or explicitly enabled by
 * VXNCI Intelligence. Registration is deliberate: no provider is activated
 * merely because an environment variable or model name is present.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistration>();

  register(registration: ProviderRegistration): void {
    const { id, name, kind, adapter } = registration;

    if (!id.trim() || !name.trim()) {
      throw new ProviderRegistrationError(
        "Provider id and name must both be non-empty."
      );
    }

    if (adapter.providerId !== id) {
      throw new ProviderRegistrationError(
        "The adapter providerId must match the registered provider id."
      );
    }

    if (!adapter.modelId.trim()) {
      throw new ProviderRegistrationError(
        "The adapter must declare a non-empty modelId."
      );
    }

    if (this.providers.has(id)) {
      throw new ProviderRegistrationError(
        `Provider "${id}" is already registered.`
      );
    }

    const modelAlreadyRegistered = [...this.providers.values()].some(
      (provider) => provider.adapter.modelId === adapter.modelId
    );

    if (modelAlreadyRegistered) {
      throw new ProviderRegistrationError(
        `Model "${adapter.modelId}" is already registered.`
      );
    }

    this.providers.set(id, registration);
  }

  resolveProvider(providerId: string): ProviderRegistration | undefined {
    return this.providers.get(providerId);
  }

  resolveModel(modelId: string): ModelAdapter | undefined {
    for (const provider of this.providers.values()) {
      if (provider.adapter.modelId === modelId) {
        return provider.adapter;
      }
    }

    return undefined;
  }

  listProviders(): ProviderSummary[] {
    return [...this.providers.values()].map(({ id, name, kind, adapter }) => ({
      id,
      name,
      kind,
      modelId: adapter.modelId,
    }));
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  clear(): void {
    this.providers.clear();
  }
}

/** Shared server-side registry. Do not expose adapter instances to clients. */
export const providerRegistry = new ProviderRegistry();
