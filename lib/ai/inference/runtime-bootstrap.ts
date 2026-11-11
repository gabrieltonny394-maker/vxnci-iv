import { modelRouter } from "../model-router";
import { registerInferenceModel } from "./engine";
import { HttpInferenceBackend } from "./http-backend";
import type { ModelArtifactManifest } from "./types";

const VXNCI_TINY_MANIFEST: ModelArtifactManifest = {
  formatVersion: 1,
  modelId: "vxnci-1-tiny",
  architecture: "decoder-only-transformer",
  tokenizer: "byte-level-BPE",
  weightsPath: "artifacts/vxnci-1-tiny/checkpoint/model.safetensors",
  contextLength: 512,
  maxOutputTokens: 256,
};

let registrationInProgress: Promise<boolean> | undefined;

/**
 * Attach the configured local/self-hosted runtime only after its health
 * endpoint confirms the exact model ID. Missing config or an offline runtime
 * leaves the catalogue empty and the chat API in its truthful 503 state.
 */
export async function ensureConfiguredInferenceModelRegistered(): Promise<boolean> {
  const baseUrl = process.env.LUXORA_INFERENCE_URL;
  const token = process.env.LUXORA_INFERENCE_TOKEN;
  if (!baseUrl || !token) return false;

  const modelId = process.env.LUXORA_MODEL_ID ?? VXNCI_TINY_MANIFEST.modelId;
  if (modelId !== VXNCI_TINY_MANIFEST.modelId) return false;
  if (modelRouter.listProviders().some((p) => p.modelId === modelId)) return true;

  if (registrationInProgress) return registrationInProgress;
  registrationInProgress = (async () => {
    try {
      const backend = new HttpInferenceBackend({ modelId, baseUrl, token });
      if (!(await backend.isReady())) return false;

      registerInferenceModel({
        registry: { register: (provider) => modelRouter.register(provider) },
        providerId: process.env.LUXORA_PROVIDER_ID ?? "luxora-local-runtime",
        providerName: process.env.LUXORA_PROVIDER_NAME ?? "LUXORA Local Runtime",
        providerKind: "self-hosted",
        manifest: VXNCI_TINY_MANIFEST,
        backend,
      });
      return true;
    } catch (error) {
      console.error("LUXORA inference runtime registration failed:", error instanceof Error ? error.name : "UnknownError");
      return false;
    } finally {
      registrationInProgress = undefined;
    }
  })();
  return registrationInProgress;
}
