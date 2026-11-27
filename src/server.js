import { createApp } from "./app.js";
import { createProviderFromEnv } from "./provider.js";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const provider = createProviderFromEnv();
const server = createApp({ provider });
server.listen(port, "0.0.0.0", () => {
  console.log("LUXORA AI listening on port " + port);
  console.log("Model provider: " + (provider.configured ? "Gemini (" + provider.model + ")" : "not configured"));
});
