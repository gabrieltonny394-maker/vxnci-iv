import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { modelRouter } from "../model-router";
import { registerInferenceModel } from "./engine";
import { HttpInferenceBackend } from "./http-backend";
import type { ModelArtifactManifest } from "./types";

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

  const configuredModelId = process.env.LUXORA_MODEL_ID;
  if (configuredModelId && modelRouter.listProviders().some((p) => p.modelId === configuredModelId)) {
    return true;
  }

  if (registrationInProgress) return registrationInProgress;
  registrationInProgress = (async () => {
    try {
      const configPath = resolve(process.cwd(), process.env.LUXORA_MODEL_CONFIG_PATH ?? "model/vxnci-1-tiny/config.json");
      const raw = JSON.parse(await readFile(configPath, "utf8")) as {
        modelId?: string;
        architecture?: string;
        components?: { tokenizer?: string };
        parameters?: { contextLength?: number; maxOutputTokens?: number };
      };
      const modelId = configuredModelId ?? raw.modelId;
      if (!modelId || raw.modelId !== modelId ||
          !raw.architecture || !raw.components?.tokenizer ||
          !Number.isInteger(raw.parameters?.contextLength) ||
          !Number.isInteger(raw.parameters?.maxOutputTokens)) {
        return false;
      }
      if (modelRouter.listProviders().some((p) => p.modelId === modelId)) return true;

      const backend = new HttpInferenceBackend({ modelId, baseUrl, token });
      if (!(await backend.isReady())) return false;

      const manifest: ModelArtifactManifest = {
        formatVersion: 1,
        modelId,
        architecture: raw.architecture,
        tokenizer: raw.components.tokenizer,
        weightsPath: `artifacts/${modelId}/checkpoint/model.safetensors`,
        contextLength: raw.parameters.contextLength as number,
        maxOutputTokens: raw.parameters.maxOutputTokens as number,
      };
      registerInferenceModel({
        registry: { register: (provider) => modelRouter.register(provider) },
        providerId: process.env.LUXORA_PROVIDER_ID ?? "luxora-local-runtime",
        providerName: process.env.LUXORA_PROVIDER_NAME ?? "LUXORA Local Runtime",
        providerKind: "self-hosted",
        manifest,
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
