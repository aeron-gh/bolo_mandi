"use client";
// Thumb zone at the bottom: what the trader said, the main button, the mic.
import { KeyboardIcon } from "./icons.tsx";
import { MicButton } from "./mic-button.tsx";

export type MainAction = { label: string; tone: "go" | "danger"; disabled: boolean; run: () => void };

type Props = {
  words: string;
  question: string | null;
  problem: string | null;
  action: MainAction;
  hint: string | null;
  busy: boolean;
  micDisabled: boolean;
  onReplay: (() => void) | null;
  onStart: () => void;
  onWords: (text: string) => void;
  onFinish: (text: string, problem?: string) => void;
  onLikho: () => void;
};

const tones = {
  go: "bg-coconut outline-coconut hover:bg-coconut-deep",
  danger: "bg-red outline-red",
};

export function Dock({ words, question, problem, action, hint, busy, micDisabled, onReplay, onStart, onWords, onFinish, onLikho }: Props) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-canvas px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto max-w-lg space-y-3">
        {words && <p className="wrap-anywhere text-muted">&ldquo;{words}&rdquo;</p>}
        {question && (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 wrap-anywhere text-lg font-medium leading-snug">{question}</p>
            {onReplay && (
              <button onClick={onReplay} disabled={busy} className="min-h-11 rounded-lg px-2 font-semibold text-coconut outline-coconut focus-visible:outline-2 disabled:opacity-40">
                Phir suno
              </button>
            )}
          </div>
        )}
        {problem && <p role="alert" className="font-medium text-red">{problem}</p>}
        <button
          onClick={action.run}
          disabled={action.disabled || busy}
          className={`h-16 w-full rounded-2xl text-xl font-semibold text-white outline-offset-2 focus-visible:outline-3 disabled:opacity-40 ${tones[action.tone]}`}
        >
          {action.label}
        </button>
        {hint && <p className="text-center text-sm text-muted">{hint}</p>}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <button
            onClick={onLikho}
            disabled={busy}
            className="flex h-14 items-center gap-2 justify-self-start rounded-xl px-3 font-medium outline-coconut hover:bg-paper focus-visible:outline-2 disabled:opacity-40"
          >
            <KeyboardIcon className="size-6" />
            Likho
          </button>
          <MicButton disabled={micDisabled} onStart={onStart} onWords={onWords} onFinish={onFinish} />
          <span />
        </div>
      </div>
    </div>
  );
}
