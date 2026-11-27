const form = document.querySelector("#composer");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const conversation = document.querySelector("#conversation");
const intro = document.querySelector("#intro");
const status = document.querySelector("#connection-status");
const newChatButton = document.querySelector("#new-chat");

let conversationId = crypto.randomUUID();
let sending = false;

function setStatus(message, state = "") {
  status.textContent = message;
  status.className = "connection-status" + (state ? " " + state : "");
}

function addMessage(role, content, extraClass = "") {
  const item = document.createElement("article");
  item.className = "message " + role + (extraClass ? " " + extraClass : "");
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "LUXORA AI";
  const body = document.createElement("div");
  body.className = "message-content";
  body.textContent = content;
  item.append(label, body);
  messages.append(item);
  conversation.hidden = false;
  intro.hidden = true;
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return item;
}

function setSending(value) {
  sending = value;
  sendButton.disabled = value;
  input.disabled = value;
  sendButton.querySelector("span").textContent = value ? "Sending…" : "Send";
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) throw new Error("Health check failed");
    const data = await response.json();
    if (data.providerConfigured) {
      setStatus("Gemini key configured", "ready");
    } else {
      setStatus("Model key not configured", "offline");
    }
  } catch {
    setStatus("Service unavailable", "offline");
  }
}

async function sendMessage(text) {
  addMessage("user", text);
  const pending = addMessage("assistant", "LUXORA AI is thinking…", "typing");
  setSending(true);
  try {
    const response = await fetch("/v1/conversations/" + encodeURIComponent(conversationId) + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text })
    });
    const data = await response.json();
    pending.remove();
    if (!response.ok) {
      const code = data?.error?.code;
      const message = code === "MODEL_PROVIDER_NOT_CONFIGURED"
        ? "Gemini is not connected yet. Add the API key to the server environment, then restart LUXORA AI."
        : code === "MODEL_PROVIDER_FAILED"
          ? "Gemini could not answer this time. Your message was not saved. Please try again."
          : (data?.error?.message || "Something went wrong. Please try again.");
      addMessage("assistant", message, "error");
      return;
    }
    addMessage("assistant", data.assistantMessage.content);
  } catch {
    pending.remove();
    addMessage("assistant", "I couldn't reach the LUXORA AI server. Check the connection and try again.", "error");
  } finally {
    setSending(false);
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || sending) return;
  input.value = "";
  input.style.height = "auto";
  sendMessage(text);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  if (sending) return;
  conversationId = crypto.randomUUID();
  messages.replaceChildren();
  conversation.hidden = true;
  intro.hidden = false;
  input.value = "";
  input.focus();
});

checkHealth();
