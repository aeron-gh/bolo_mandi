import { createServer } from "node:http";
import next from "next";
import { attachSarvam } from "./sarvam.mjs";

const dev = process.argv.includes("--dev");
process.env.NODE_ENV ??= dev ? "development" : "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = "127.0.0.1";
const app = next({ dev, hostname, port });
await app.prepare();

const subscriptionKey = process.env.SARVAM_API_KEY?.trim();
const handle = app.getRequestHandler();
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/speech/status") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ sarvam: Boolean(subscriptionKey) }));
    return;
  }
  void handle(request, response);
});

if (subscriptionKey) attachSarvam(server, subscriptionKey);
server.listen(port, hostname, () => {
  console.log(`Bolo on http://${hostname}:${port} (Sarvam ${subscriptionKey ? "enabled" : "disabled"})`);
});
