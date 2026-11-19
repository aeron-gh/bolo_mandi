let status: Promise<boolean> | undefined;

export function sarvamAvailable(): Promise<boolean> {
  return status ??= fetch("/api/speech/status", { signal: AbortSignal.timeout(1500) })
    .then(async (response) => response.ok && (await response.json()).sarvam === true)
    .catch(() => false);
}

export function listenWithSarvam(stream: MediaStream, onWords: (words: string) => void, warmFallback: () => void) {
  const result = Promise.withResolvers<string>();
  const url = new URL("/speech/sarvam", location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const context = new AudioContext({ sampleRate: 16000 });
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch (error) {
    void context.close();
    throw error;
  }
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let ending = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queued: ArrayBuffer[] = [];
  let drained = false;

  function flushSocket() {
    if (socket.readyState !== WebSocket.OPEN) return;
    for (const packet of queued) socket.send(packet);
    queued.length = 0;
    if (drained) socket.send("end");
  }

  function settle(text: string) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    queued.length = 0;
    source?.disconnect();
    node?.disconnect();
    node?.port.close();
    void context.close();
    socket.close();
    result.resolve(text);
  }

  function fail() {
    if (!settled) warmFallback();
    settle("");
  }

  socket.onopen = flushSocket;
  socket.onerror = fail;
  socket.onclose = fail;
  socket.onmessage = ({ data }) => {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return fail();
    }
    if (!event || typeof event !== "object") return fail();
    if (event.kind === "partial" && typeof event.text === "string") onWords(event.text);
    if (event.kind === "final" && ending && typeof event.text === "string") settle(event.text);
    if (event.kind === "error") fail();
  };

  const ready = (async () => {
    if (context.sampleRate !== 16000) throw new Error("16 kHz audio unavailable");
    await context.audioWorklet.addModule("/sarvam-pcm.js");
    if (settled || ending) return;
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, "sarvam-pcm", { channelCount: 1, channelCountMode: "explicit" });
    node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer | null>) => {
      if (settled || drained) return;
      if (data === null) drained = true;
      else queued.push(data);
      flushSocket();
    };
    source.connect(node).connect(context.destination);
    await context.resume();
  })().catch(fail);

  return {
    ready,
    finish() {
      if (!ending && !settled) {
        ending = true;
        timer = setTimeout(fail, 2400);
        if (node) node.port.postMessage("flush");
        else fail();
      }
      return result.promise;
    },
    discard: () => settle(""),
  };
}
