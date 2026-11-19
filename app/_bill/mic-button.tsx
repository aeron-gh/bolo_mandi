"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { clearSpeech } from "@/lib/voice-text.ts";
import { listenInBrowser } from "./browser-recognition.ts";
import { decodeSpeech, hasSpeech, transcribeOnDevice, warmOnDevice } from "./on-device-speech.ts";

import { listenWithSarvam, sarvamAvailable } from "./sarvam-recognition.ts";

type Props = {
  disabled: boolean;
  onStart: () => void;
  onWords: (text: string) => void;
  onFinish: (text: string, problem?: string) => void;
};

type Session = { release: () => void; discard: () => void; cancel: () => void; dispose: () => void };
type Phase = "idle" | "connecting" | "listening" | "recognizing" | "loading";

const REPEAT = "I couldn't hear that clearly. Please say it again.";
const LABEL: Record<Phase, string> = {
  idle: "Hold to speak",
  connecting: "Connecting the mic",
  listening: "Listening",
  recognizing: "Understanding",
  loading: "Downloading the speech model",
};

function micProblem(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Allow the microphone in your browser, or add items by hand.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone found. Connect one, or add items by hand.";
  }
  return "The mic didn't record. Check it, or add items by hand.";
}

function watchLevel(ring: HTMLSpanElement, stream: MediaStream): (() => void) | undefined {
  if (!window.AudioContext || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const audio = new AudioContext();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  audio.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
    const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
    ring.style.transform = `scale(${1 + level * 0.5})`;
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    ring.style.transform = "";
    void audio.close();
  };
}

export function MicButton({ disabled, onStart, onWords, onFinish }: Props) {
  const ring = useRef<HTMLSpanElement>(null);
  const session = useRef<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const held = phase === "connecting" || phase === "listening";
  const processing = phase === "recognizing" || phase === "loading";

  useEffect(() => {
    void sarvamAvailable();
    return () => session.current?.dispose();
  }, []);

  function start() {
    if (disabled || session.current) return;
    if (!window.isSecureContext) return onFinish("", "The mic only works on HTTPS or localhost.");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return onFinish("", "This browser can't record. Try Chrome, or add items by hand.");
    }

    const controller = new AbortController();
    const { signal } = controller;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let recognition: ReturnType<typeof listenInBrowser> | ReturnType<typeof listenWithSarvam>;
    let nativeWords: Promise<string> | undefined;
    let stopLevel: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let released = false;
    const chunks: Blob[] = [];

    function stopInput() {
      stopLevel?.();
      stopLevel = undefined;
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
    }

    function dispose() {
      session.current = null;
      clearTimeout(timer);
      controller.abort();
      recognition?.discard();
      if (recorder) {
        recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopInput();
    }

    function finish(text: string, problem?: string) {
      dispose();
      setPhase("idle");
      onFinish(text, problem);
    }

    function release() {
      if (released) return;
      released = true;
      if (!recorder) return finish("", "Press and hold again once the mic is ready.");
      setPhase("recognizing");
      stopLevel?.();
      stopLevel = undefined;
      clearTimeout(timer);
      timer = setTimeout(() => finish("", REPEAT), 3000);
      nativeWords = recognition?.finish();
      if (recorder.state !== "inactive") recorder.stop();
    }

    async function readRecording() {
      if (!released) return finish("", "The recording stopped. Speak again, or add items by hand.");
      const words = await nativeWords;
      if (signal.aborted) return;
      clearTimeout(timer);
      stopInput();
      if (words && clearSpeech(words)) return finish(words);

      onWords("");
      const recording = new Blob(chunks, { type: recorder?.mimeType });
      let samples: Float32Array;
      try {
        if (!recording.size) return finish("", REPEAT);
        samples = await decodeSpeech(recording);
      } catch {
        if (!signal.aborted) finish("", REPEAT);
        return;
      }
      if (signal.aborted) return;
      if (!hasSpeech(samples)) return finish("", REPEAT);
      try {
        const text = await transcribeOnDevice(samples, signal, setPhase);
        if (!signal.aborted) {
          if (clearSpeech(text)) finish(text);
          else finish("", REPEAT);
        }
      } catch (error) {
        if (!signal.aborted) finish("", error instanceof Error ? error.message : REPEAT);
      }
    }

    session.current = {
      release,
      discard: () => { if (!released) finish(""); },
      cancel: () => finish(""),
      dispose,
    };
    onStart();
    setPhase("connecting");
    void navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } })
      .then(async (input) => {
        if (signal.aborted) {
          input.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = input;
        recorder = new MediaRecorder(input);
        recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
        recorder.onstop = () => void readRecording();
        recorder.onerror = () => finish("", "The mic didn't record. Speak again, or add items by hand.");
        recorder.start();
        timer = setTimeout(() => finish("", "Speak for up to 20 seconds at a time."), 20000);
        const useSarvam = await sarvamAvailable();
        if (signal.aborted || released) return;
        const showWords = (text: string) => onWords(clearSpeech(text) ? text : "");
        const track = input.getAudioTracks()[0];
        if (useSarvam && window.AudioContext) {
          try {
            const cloud = listenWithSarvam(input, showWords, warmOnDevice);
            recognition = cloud;
            await cloud.ready;
          } catch {
            // A failed cloud connection can fall back to browser recognition.
          }
        }
        if (signal.aborted || released) return;
        if (!recognition && track) recognition = listenInBrowser(track, showWords, warmOnDevice);
        if (!recognition) warmOnDevice();
        if (ring.current) {
          try {
            stopLevel = watchLevel(ring.current, input);
          } catch {
            // The level ring is optional.
          }
        }
        setPhase("listening");
      })
      .catch((error) => {
        if (!signal.aborted) finish("", micProblem(error));
      });
  }

  function onKey(event: KeyboardEvent, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down && !event.repeat) start();
    if (!down) session.current?.release();
  }

  return (
    <div className="voice-control">
      <button
        type="button"
        aria-label="Hold to speak"
        aria-pressed={held}
        disabled={disabled || processing}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          start();
        }}
        onPointerUp={() => session.current?.release()}
        onPointerCancel={() => session.current?.discard()}
        onLostPointerCapture={() => session.current?.discard()}
        onBlur={() => session.current?.discard()}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => onKey(event, true)}
        onKeyUp={(event) => onKey(event, false)}
        className={`orb-button ${held ? "orb-active" : ""}`}
      >
        <span aria-hidden className="orb-halo" ref={ring} />
        <span aria-hidden className="orb-surface">
          <span className="orb-wave"><i /><i /><i /><i /><i /><i /><i /></span>
        </span>
      </button>
      <span role="status" className="voice-label">{LABEL[phase]}</span>
      {processing && (
        <button type="button" onClick={() => session.current?.cancel()} className="min-h-9 px-3 font-medium text-[#395f80] focus-visible:outline-2">
          Roko
        </button>
      )}
    </div>
  );
}
