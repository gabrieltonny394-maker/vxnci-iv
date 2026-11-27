import test from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "../src/gemini-provider.js";

test("Gemini adapter sends stateless Interactions API requests and retains exact steps", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    const turn = requests.length;
    return {
      ok: true,
      async json() {
        return {
          status: "completed",
          model: "gemini-3.8-flash",
          steps: [{
            type: "model_output",
            content: [{ type: "text", text: turn === 1 ? "Hello from Gemini." : "I remember the first turn." }]
          }]
        };
      }
    };
  };

  const provider = new GeminiProvider({ apiKey: "test-key-not-real", model: "gemini-3.8-flash", fetchImpl });
  const first = await provider.generate({
    conversationId: "chat-a",
    messages: [{ role: "user", content: "Hello" }]
  });
  assert.equal(first.content, "Hello from Gemini.");
  assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(requests[0].options.headers["x-goog-api-key"], "test-key-not-real");
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.input[0].type, "user_input");

  const second = await provider.generate({
    conversationId: "chat-a",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hello from Gemini." },
      { role: "user", content: "Do you remember?" }
    ]
  });
  assert.equal(second.content, "I remember the first turn.");
  assert.equal(requests[1].body.input.length, 3);
  assert.equal(requests[1].body.input[1].type, "model_output");
  assert.equal(requests[1].body.input[2].content[0].text, "Do you remember?");
});

test("Gemini adapter does not return provider error details to callers", async () => {
  const provider = new GeminiProvider({
    apiKey: "test-key-not-real",
    fetchImpl: async () => ({
      ok: false,
      async json() { return { error: { message: "sensitive upstream detail" } }; }
    })
  });
  await assert.rejects(
    provider.generate({ conversationId: "chat-b", messages: [{ role: "user", content: "Hi" }] }),
    error => error.message === "Gemini could not complete the request."
  );
});
