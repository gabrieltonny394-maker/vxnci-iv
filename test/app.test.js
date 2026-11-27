import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(app, run) {
  await new Promise(resolve => app.listen(0, "127.0.0.1", resolve));
  const address = app.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => app.close(error => error ? reject(error) : resolve()));
  }
}

test("health endpoint reports prototype and unconfigured provider honestly", async () => {
  await withServer(createApp(), async base => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.providerConfigured, false);
    assert.equal(body.lifecycle, "Prototype");
  });
});

test("conversation endpoint refuses to fake an answer without a provider", async () => {
  await withServer(createApp(), async base => {
    const response = await fetch(`${base}/v1/conversations/demo/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Hello" })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "MODEL_PROVIDER_NOT_CONFIGURED");
  });
});

test("configured provider receives conversation context and returns an assistant message", async () => {
  const calls = [];
  const provider = {
    async generate(input) {
      calls.push(input);
      return { content: "Hello. How can I help?", model: "test-provider/model" };
    }
  };

  await withServer(createApp({ provider }), async base => {
    const first = await fetch(`${base}/v1/conversations/chat_1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Hello" })
    });
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.userMessage.role, "user");
    assert.equal(firstBody.assistantMessage.role, "assistant");
    assert.equal(firstBody.assistantMessage.model, "test-provider/model");

    const second = await fetch(`${base}/v1/conversations/chat_1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Remember my greeting" })
    });
    assert.equal(second.status, 200);
    assert.equal(calls[1].messages.length, 3);
    assert.equal(calls[1].messages[0].content, "Hello");
    assert.equal(calls[1].messages[1].content, "Hello. How can I help?");
    assert.equal(calls[1].messages[2].content, "Remember my greeting");
  });
});

test("invalid message is rejected before provider invocation", async () => {
  let called = false;
  const provider = { async generate() { called = true; return { content: "ok", model: "test" }; } };

  await withServer(createApp({ provider }), async base => {
    const response = await fetch(`${base}/v1/conversations/demo/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "   " })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_MESSAGE");
    assert.equal(called, false);
  });
});

test("invalid JSON returns a structured error", async () => {
  await withServer(createApp(), async base => {
    const response = await fetch(`${base}/v1/conversations/demo/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_JSON");
  });
});
