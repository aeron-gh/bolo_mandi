export const SPEECH_SAMPLE_RATE = 16000;

export type SpeechMessage =
  | { kind: "loading" | "recognizing" | "error" }
  | { kind: "transcript"; text: string };

export type SpeechRequest = { kind: "warm" } | { kind: "transcribe"; samples: Float32Array };

let worker: Worker | undefined;

function getWorker(): Worker {
  if (worker) return worker;
  const transcriber = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
  transcriber.addEventListener("error", () => {
    transcriber.terminate();
    if (worker === transcriber) worker = undefined;
  }, { once: true });
  return worker = transcriber;
}

export function warmOnDevice() {
  try {
    getWorker().postMessage({ kind: "warm" } satisfies SpeechRequest);
  } catch {
    // Starting a transcription will retry worker setup and show any error.
  }
}

export async function decodeSpeech(recording: Blob): Promise<Float32Array> {
  // decodeAudioData resamples to its context's sample rate.
  const context = new OfflineAudioContext(1, 1, SPEECH_SAMPLE_RATE);
  const audio = await context.decodeAudioData(await recording.arrayBuffer());
  return audio.getChannelData(0);
}

export function hasSpeech(samples: Float32Array): boolean {
  // Skip effectively silent recordings before handing them to a generative model.
  const frameSize = SPEECH_SAMPLE_RATE / 40;
  let audibleFrames = 0;
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let power = 0;
    for (let i = start; i < start + frameSize; i++) power += samples[i] ** 2;
    if (power / frameSize >= 0.003 ** 2 && ++audibleFrames >= 4) return true;
  }
  return false;
}

export function transcribeOnDevice(
  samples: Float32Array,
  signal: AbortSignal,
  status: (kind: "loading" | "recognizing") => void,
): Promise<string> {
  signal.throwIfAborted();
  const transcriber = getWorker();

  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      transcriber.removeEventListener("message", onMessage);
      transcriber.removeEventListener("error", failed);
    }

    function abort() {
      cleanup();
      transcriber.terminate();
      if (worker === transcriber) worker = undefined;
      reject(signal.reason);
    }

    function failed() {
      cleanup();
      transcriber.terminate();
      if (worker === transcriber) worker = undefined;
      reject(new Error("The offline speech model isn't ready. The first time needs internet. Try again, or add items by hand."));
    }

    function onMessage({ data }: MessageEvent<SpeechMessage>) {
      if (data.kind === "loading" || data.kind === "recognizing") status(data.kind);
      if (data.kind === "error") failed();
      if (data.kind === "transcript") {
        cleanup();
        resolve(data.text);
      }
    }

    const timer = setTimeout(failed, 120000);
    signal.addEventListener("abort", abort, { once: true });
    transcriber.addEventListener("message", onMessage);
    transcriber.addEventListener("error", failed);
    try {
      transcriber.postMessage({ kind: "transcribe", samples } satisfies SpeechRequest, [samples.buffer]);
    } catch {
      failed();
    }
  });
}
