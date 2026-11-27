import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UnconfiguredProvider, ProviderNotConfiguredError } from "./provider.js";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 4000;
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"]
};

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

async function sendStatic(response, fileName, contentType) {
  try {
    const body = await readFile(path.join(PUBLIC_DIR, fileName));
    response.writeHead(200, {
      "content-type": contentType,
      "content-length": body.length,
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(body);
  } catch {
    sendJson(response, 500, { error: { code: "ASSET_UNAVAILABLE", message: "The application interface could not be loaded." } });
  }
}

async function readJson(request) {
  let body = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    body += chunk.toString("utf8");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

export function createApp({ provider = new UnconfiguredProvider() } = {}) {
  const conversations = new Map();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && STATIC_FILES[url.pathname]) {
      const [fileName, contentType] = STATIC_FILES[url.pathname];
      return sendStatic(response, fileName, contentType);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        service: "luxora-ai-conversation-api",
        providerConfigured: provider.configured ?? !(provider instanceof UnconfiguredProvider),
        provider: provider.configured ? "gemini" : null,
        model: provider.configured ? provider.model ?? null : null,
        storage: "in-memory",
        lifecycle: "Prototype"
      });
    }

    const match = url.pathname.match(/^\/v1\/conversations\/([a-zA-Z0-9_-]{1,80})\/messages$/);
    if (request.method !== "POST" || !match) {
      return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route not found." } });
    }

    let input;
    try {
      input = await readJson(request);
    } catch (error) {
      return sendJson(response, error.statusCode ?? 400, {
        error: { code: error.statusCode === 413 ? "BODY_TOO_LARGE" : "INVALID_JSON", message: error.message }
      });
    }

    if (typeof input.content !== "string" || !input.content.trim()) {
      return sendJson(response, 400, {
        error: { code: "INVALID_MESSAGE", message: "content must be a non-empty string." }
      });
    }

    const content = input.content.trim();
    if (content.length > MAX_MESSAGE_LENGTH) {
      return sendJson(response, 400, {
        error: { code: "MESSAGE_TOO_LONG", message: "content must be at most " + MAX_MESSAGE_LENGTH + " characters." }
      });
    }

    const conversationId = match[1];
    const existing = conversations.get(conversationId) ?? [];
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    const candidateHistory = [...existing, userMessage];

    try {
      const generated = await provider.generate({
        conversationId,
        messages: candidateHistory.map(({ role, content: text }) => ({ role, content: text }))
      });

      if (!generated || typeof generated.content !== "string" || !generated.content.trim() ||
          typeof generated.model !== "string" || !generated.model.trim()) {
        return sendJson(response, 502, {
          error: { code: "INVALID_PROVIDER_RESPONSE", message: "The model provider returned an invalid response." }
        });
      }

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: generated.content.trim(),
        model: generated.model,
        createdAt: new Date().toISOString()
      };
      conversations.set(conversationId, [...candidateHistory, assistantMessage]);
      return sendJson(response, 200, {
        conversationId,
        userMessage,
        assistantMessage,
        lifecycle: "Prototype"
      });
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        return sendJson(response, 503, {
          error: { code: "MODEL_PROVIDER_NOT_CONFIGURED", message: error.message }
        });
      }
      return sendJson(response, 502, {
        error: { code: "MODEL_PROVIDER_FAILED", message: "The model provider failed to generate a response. The message was not saved." }
      });
    }
  });
}
