"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MicIcon } from "./icons.tsx";

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

type Props = {
  disabled: boolean;
  onStart: () => void;
  onWords: (text: string) => void;
  onFinish: (text: string, problem?: string) => void;
};

type Session = { release: () => void; discard: () => void; dispose: () => void };

const REPEAT = "Awaaz saaf nahi aayi. Phir se bolo ya Likho kholo.";

function recognitionProblem(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") return "Browser mein mic allow karo, ya Likho kholo.";
  if (error === "network") return "Awaaz ki service se connection nahi hua. Phir se bolo ya Likho kholo.";
  return REPEAT;
}

// The separate level meter is optional. Recognition can still work if the browser cannot open it.
async function watchLevel(ring: HTMLSpanElement, active: () => boolean): Promise<(() => void) | undefined> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => stream.getTracks().forEach((track) => track.stop());
  if (!active()) {
    release();
    return;
  }
  let audio: AudioContext | undefined;
  try {
    audio = new AudioContext();
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
    const meter = audio;
    return () => {
      cancelAnimationFrame(frame);
      ring.style.transform = "";
      release();
      void meter.close();
    };
  } catch {
    release();
    if (audio) void audio.close();
  }
}

export function MicButton({ disabled, onStart, onWords, onFinish }: Props) {
  const ring = useRef<HTMLSpanElement>(null);
  const session = useRef<Session | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => () => session.current?.dispose(), []);

  function start() {
    if (disabled || session.current) return;
    if (!window.isSecureContext) return onFinish("", "Mic sirf HTTPS ya localhost par chalta hai.");
    const Recognizer = recognitionClass();
    if (!Recognizer) return onFinish("", "Is browser mein mic se bill nahi banta. Chrome ya Likho try karo.");

    const rec = new Recognizer();
    rec.lang = "hi-IN";
    rec.interimResults = true;
    rec.continuous = true;
    let finalized = "";
    let released = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopLevel: (() => void) | undefined;

    function dispose() {
      session.current = null;
      clearTimeout(timer);
      stopLevel?.();
      stopLevel = undefined;
      rec.onresult = rec.onerror = rec.onend = null;
    }

    function discard(problem?: string) {
      dispose();
      rec.abort();
      setHeld(false);
      onFinish("", problem);
    }

    function release() {
      if (released) return;
      released = true;
      setHeld(false);
      stopLevel?.();
      stopLevel = undefined;
      // Some services never emit end after a failed stop. Drop that turn.
      timer = setTimeout(() => discard(REPEAT), 5000);
      rec.stop();
    }

    const recording: Session = { release, discard: () => { if (!released) discard(); }, dispose: () => { dispose(); rec.abort(); } };
    rec.onresult = ({ results }) => {
      const all = Array.from(results);
      finalized = all.filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).join(" ").trim();
      onWords(all.map((result) => result[0].transcript.trim()).join(" ").trim());
    };
    rec.onerror = ({ error }) => discard(recognitionProblem(error));
    rec.onend = () => {
      dispose();
      setHeld(false);
      if (released && finalized) onFinish(finalized);
      else onFinish("", REPEAT);
    };

    session.current = recording;
    setHeld(true);
    onStart();
    try {
      rec.start();
    } catch {
      discard(REPEAT);
      return;
    }
    if (ring.current) {
      const active = () => session.current === recording && !released;
      void watchLevel(ring.current, active).then((cleanup) => {
        if (active()) stopLevel = cleanup;
        else cleanup?.();
      }).catch(() => {});
    }
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
        disabled={disabled}
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
      <span className="text-sm text-muted">{held ? "Sun raha hoon" : "Daba ke bolo"}</span>
    </div>
  );
}
