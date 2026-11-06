import type { ModelAdapter } from "./contracts";
import { ModelNotConfiguredError } from "./contracts";

/**
 * Central model selection boundary.
 * Register only adapters that have been deliberately configured server-side.
 */
export class ModelRouter {
  private readonly adapters = new Map<string, ModelAdapter>();

  register(adapter: ModelAdapter): void {
    this.adapters.set(adapter.modelId, adapter);
  }

  resolve(modelId: string): ModelAdapter {
    const adapter = this.adapters.get(modelId);
    if (!adapter) throw new ModelNotConfiguredError();
    return adapter;
  }
}

export const modelRouter = new ModelRouter();
