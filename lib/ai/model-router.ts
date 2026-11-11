import type { ModelAdapter } from "./contracts";
import { ModelNotFoundError } from "./contracts";
import {
  providerRegistry,
  type ProviderRegistration,
  type ProviderSummary,
} from "./providers/provider-registry";

/**
 * Compatibility facade for the AI Core.
 * All model resolution now passes through the LUXORA AI Provider Registry.
 */
export class ModelRouter {
  register(provider: ProviderRegistration): void {
    providerRegistry.register(provider);
  }

  resolve(modelId: string): ModelAdapter {
    const adapter = providerRegistry.resolveModel(modelId);
    if (!adapter) throw new ModelNotFoundError(modelId);
    return adapter;
  }

  listProviders(): ProviderSummary[] {
    return providerRegistry.listProviders();
  }
}

export const modelRouter = new ModelRouter();
