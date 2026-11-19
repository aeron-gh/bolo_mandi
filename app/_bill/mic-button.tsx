"use client";
// Hold to speak. The ring grows with voice loudness; the words go up to the parent.
// Turning words into bill actions comes with the voice step.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MicIcon } from "./icons.tsx";

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type RecognitionClass = new () => Recognition;

// Chrome still ships speech recognition under the webkit name.
function recognitionClass(): RecognitionClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = { onWords: (text: string) => void; onProblem: (message: string | null) => void };

export function MicButton({ onWords, onProblem }: Props) {
  const ring = useRef<HTMLSpanElement>(null);
  const wanted = useRef(false);
  const live = useRef<(() => void) | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => () => live.current?.(), []);

  // Loudness ring: read the mic level every frame and scale the ring directly (no re-render).
  function watchLevel(stream: MediaStream): () => void {
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 5);
      if (ring.current && !calm) ring.current.style.transform = `scale(${1 + level * 0.5})`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      void audio.close();
      if (ring.current) ring.current.style.transform = "";
    };
  }

  // Live words in Hindi/Hinglish from the browser's free speech-to-text.
  function listen(Recognizer: RecognitionClass): () => void {
    const rec = new Recognizer();
    rec.lang = "hi-IN";
    rec.interimResults = true;
    rec.continuous = true;
    let said = "";
    rec.onresult = (event) => {
      let guess = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) said += `${r[0].transcript} `;
        else guess += r[0].transcript;
      }
      onWords(`${said}${guess}`.trim());
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") onProblem(`Sunne mein dikkat: ${event.error}`);
    };
    rec.start();
    return () => rec.stop();
  }

  async function start() {
    if (wanted.current) return;
    wanted.current = true;
    setHeld(true);
    onProblem(null);
    if (!window.isSecureContext) return onProblem("Mic sirf https ya localhost par chalta hai.");
    const Recognizer = recognitionClass();
    if (!Recognizer) return onProblem("Is browser mein bolna nahi chalta. Chrome kholo.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onProblem("Mic ki permission nahi mili. Browser mein mic allow karo.");
    }
    // Released while the permission box was open: give the mic back at once.
    if (!wanted.current) return stream.getTracks().forEach((t) => t.stop());
    onWords("");
    const stopLevel = watchLevel(stream);
    const stopWords = listen(Recognizer);
    live.current = () => {
      stopWords();
      stopLevel();
      stream.getTracks().forEach((t) => t.stop());
    };
  }

  function stop() {
    wanted.current = false;
    setHeld(false);
    live.current?.();
    live.current = null;
  }

  function onKey(event: KeyboardEvent, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down && !event.repeat) void start();
    if (!down) stop();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label="Daba ke bolo"
        aria-pressed={held}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        className={`relative grid size-22 touch-none select-none place-items-center rounded-full text-white outline-coconut outline-offset-4 focus-visible:outline-3 ${held ? "bg-coconut-deep" : "bg-coconut"}`}
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
