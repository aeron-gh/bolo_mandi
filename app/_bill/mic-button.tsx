"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { clearSpeech } from "@/lib/voice-text.ts";
import { listenInBrowser } from "./browser-recognition.ts";
import { MicIcon } from "./icons.tsx";
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

const REPEAT = "Mujhe saaf sunai nahi diya. Ek baar phir bolo.";
const LABEL: Record<Phase, string> = {
  idle: "Daba ke bolo",
  connecting: "Mic jud raha hai",
  listening: "Sun raha hoon",
  recognizing: "Awaaz samajh raha hoon",
  loading: "Hindi voice download ho rahi hai",
};

function micProblem(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Browser mein mic allow karo, ya Likho kholo.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Microphone nahi mila. Mic jodo ya Likho kholo.";
  }
  return "Mic se recording nahi hui. Mic check karo ya Likho kholo.";
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
    if (!window.isSecureContext) return onFinish("", "Mic sirf HTTPS ya localhost par chalta hai.");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return onFinish("", "Is browser mein recording nahi chalti. Chrome ya Likho try karo.");
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
      if (!recorder) return finish("", "Mic taiyaar hone par phir se daba ke bolo.");
      setPhase("recognizing");
      stopLevel?.();
      stopLevel = undefined;
      clearTimeout(timer);
      timer = setTimeout(() => finish("", REPEAT), 3000);
      nativeWords = recognition?.finish();
      if (recorder.state !== "inactive") recorder.stop();
    }

    async function readRecording() {
      if (!released) return finish("", "Mic se recording ruk gayi. Phir se bolo ya Likho kholo.");
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
        recorder.onerror = () => finish("", "Mic se recording nahi hui. Phir se bolo ya Likho kholo.");
        recorder.start();
        timer = setTimeout(() => finish("", "Ek baar mein 20 second tak bolo."), 20000);
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
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label="Daba ke bolo"
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
        className={`relative grid size-22 touch-none select-none place-items-center rounded-full text-white outline-coconut outline-offset-4 focus-visible:outline-3 disabled:opacity-40 ${held ? "bg-coconut-deep" : "bg-coconut"}`}
      >
        <span
          ref={ring}
          aria-hidden
          className={`pointer-events-none absolute -inset-1 rounded-full border-[6px] border-coconut/30 ${held ? "opacity-100" : "opacity-0"}`}
        />
        <MicIcon className="size-9" />
      </button>
      <span role="status" className="text-center text-sm text-muted">{LABEL[phase]}</span>
      {processing && (
        <button type="button" onClick={() => session.current?.cancel()} className="min-h-11 px-3 font-medium text-coconut focus-visible:outline-2">
          Roko
        </button>
      )}
    </div>
  );
}
