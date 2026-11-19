import WebSocket, { WebSocketServer } from "ws";

const path = "/speech/sarvam";
const maxFrame = 3200; // 100 ms of 16 kHz mono linear16
const maxBytes = 640000; // 20 seconds

const endpoint = new URL("wss://api.sarvam.ai/speech-to-text-realtime/ws");
endpoint.search = new URLSearchParams({
  model: "saaras:v4",
  language_code: "hi-IN",
  mode: "codemix",
  stream_type: "fast",
  endpointing: "manual",
  encoding: "linear16",
  sample_rate: "16000",
  keyterms: JSON.stringify(["grade", "crate", "piece", "cash", "UPI", "udhaar", "khata", "vasooli"]),
}).toString();

function sameOrigin({ headers }) {
  const origin = headers.origin && URL.parse(headers.origin);
  if (!origin || !["http:", "https:"].includes(origin.protocol) || origin.host !== headers.host) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    || origin.origin === process.env.SARVAM_PUBLIC_ORIGIN;
}

export function attachSarvam(server, key, connect = (url, options) => new WebSocket(url, options)) {
  const gateway = new WebSocketServer({ noServer: true, maxPayload: maxFrame });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== path) return;
    if (!sameOrigin(request) || gateway.clients.size >= 4) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    gateway.handleUpgrade(request, socket, head, (browser) => {
      const upstream = connect(endpoint, {
        headers: { "API-SUBSCRIPTION-KEY": key },
        handshakeTimeout: 3000,
        maxPayload: 65536,
      });
      relayTurn(browser, upstream);
    });
  });
}

export function relayTurn(browser, upstream) {
  const queued = [];
  let bytes = 0;
  let ready = false;
  let ended = false;
  let finished = false;
  const deadline = setTimeout(fail, 25000);

  const send = (event, fields = {}) => upstream.send(JSON.stringify({ event, ...fields }));
  const audio = (chunk) => send("audio_input", { audio: chunk.toString("base64") });

  function close() {
    clearTimeout(deadline);
    if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
    if (browser.readyState === WebSocket.OPEN) browser.close();
  }

  function fail() {
    if (finished) return;
    finished = true;
    if (browser.readyState === WebSocket.OPEN) browser.send(JSON.stringify({ kind: "error" }));
    close();
  }

  browser.on("message", (chunk, binary) => {
    if (ended || finished) return;
    if (!binary) {
      if (chunk.toString() !== "end" || !bytes) return fail();
      ended = true;
      if (ready) send("speech_end");
      return;
    }
    bytes += chunk.length;
    if (chunk.length === 0 || chunk.length % 2 || bytes > maxBytes) return fail();
    if (ready) audio(chunk);
    else queued.push(chunk);
  });

  upstream.on("message", (message) => {
    if (finished) return;
    let result;
    try {
      result = JSON.parse(message.toString());
    } catch {
      return fail();
    }
    if (!result || typeof result !== "object") return fail();
    if (result.event === "error") return fail();
    if (result.event === "session.begin" && !ready) {
      ready = true;
      send("speech_start");
      for (const chunk of queued) audio(chunk);
      queued.length = 0;
      if (ended) send("speech_end");
    }
    if (result.event === "transcript.partial" && typeof result.text === "string" && browser.readyState === WebSocket.OPEN) {
      browser.send(JSON.stringify({ kind: "partial", text: result.text }));
    }
    if (result.event === "transcript.final" && ended && typeof result.text === "string" && browser.readyState === WebSocket.OPEN) {
      finished = true;
      browser.send(JSON.stringify({ kind: "final", text: result.text }));
      send("end");
      close();
    }
  });
  upstream.on("close", fail);
  upstream.on("error", fail);
  browser.on("error", close);
  browser.on("close", close);
}
