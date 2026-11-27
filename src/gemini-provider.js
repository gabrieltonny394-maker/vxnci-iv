export class GeminiProviderError extends Error {
  constructor(message = "Gemini could not complete the request.") {
    super(message);
    this.name = "GeminiProviderError";
  }
}

/**
 * Gemini adapter using Google's Interactions API.
 * Stateless mode (store:false) keeps provider-side conversation storage off.
 * Exact returned steps are retained in this process for multi-turn context.
 */
export class GeminiProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || "gemini-3.8-flash",
    fetchImpl = fetch
  } = {}) {
    this.apiKey = typeof apiKey === "string" ? apiKey.trim() : "";
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.configured = Boolean(this.apiKey);
    this.histories = new Map();
  }

  async generate({ conversationId, messages }) {
    if (!this.configured) {
      throw new GeminiProviderError("Gemini API key is not configured on the server.");
    }

    const latest = messages.at(-1);
    if (!latest || latest.role !== "user") {
      throw new GeminiProviderError("The latest conversation item must be a user message.");
    }

    const priorSteps = this.histories.get(conversationId) ?? [];
    const input = [
      ...priorSteps,
      {
        type: "user_input",
        content: [{ type: "text", text: latest.content }]
      }
    ];

    let response;
    try {
      response = await this.fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          input
        }),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      throw new GeminiProviderError();
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new GeminiProviderError();
    }

    if (!response.ok || payload.status === "failed" || !Array.isArray(payload.steps)) {
      throw new GeminiProviderError();
    }

    const answer = payload.steps
      .filter(step => step.type === "model_output" && Array.isArray(step.content))
      .flatMap(step => step.content)
      .filter(part => part.type === "text" && typeof part.text === "string")
      .map(part => part.text)
      .join("")
      .trim();

    if (!answer) {
      throw new GeminiProviderError();
    }

    this.histories.set(conversationId, [...input, ...payload.steps]);

    return {
      content: answer,
      model: payload.model || this.model
    };
  }
}
