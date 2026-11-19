import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { SpeechMessage, SpeechRequest } from "./on-device-speech.ts";

env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;

let loading: Promise<AutomaticSpeechRecognitionPipeline> | undefined;
let ready = false;

function load() {
  return loading ??= pipeline("automatic-speech-recognition", "Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX", {
    device: "wasm",
    dtype: "q8",
    revision: "24211661105a7bb9e96a170fb92db173667e31fd",
  }).then((recognizer) => {
    ready = true;
    return recognizer;
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
}

function send(message: SpeechMessage) {
  self.postMessage(message);
}

self.addEventListener("message", async ({ data }: MessageEvent<SpeechRequest>) => {
  if (data.kind === "warm") {
    void load().catch(() => {});
    return;
  }
  try {
    if (!ready) send({ kind: "loading" });
    const recognizer = await load();
    send({ kind: "recognizing" });
    // This fine-tune uses the English language token for romanized Hindi.
    const result = await recognizer(data.samples, { language: "en", task: "transcribe", return_timestamps: false });
    const text = Array.isArray(result) ? result[0]?.text : result.text;
    send({ kind: "transcript", text: text?.trim() ?? "" });
  } catch (error) {
    console.error("On-device transcription failed", error);
    send({ kind: "error" });
  }
});
