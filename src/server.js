import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const server = createApp();
server.listen(port, "0.0.0.0", () => {
  console.log(`LUXORA AI conversation API listening on port ${port}`);
  console.log("Model provider: not configured (live generation is disabled)");
});
