"use client";
import { useState, type FormEvent } from "react";
import { KeyboardIcon } from "./icons.tsx";
import { MicButton } from "./mic-button.tsx";

export type MainAction = { label: string; tone: "go" | "danger"; disabled: boolean; run: () => void };

type Props = {
  action: MainAction;
  hint: string | null;
  busy: boolean;
  micDisabled: boolean;
  onStart: () => void;
  onWords: (text: string) => void;
  onFinish: (text: string, problem?: string) => void;
  onType: (text: string) => void;
  onLikho: () => void;
};

export function Dock({ action, hint, busy, micDisabled, onStart, onWords, onFinish, onType, onLikho }: Props) {
  const [input, setInput] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (micDisabled || busy || !input.trim()) return;
    onType(input.trim());
    setInput("");
  }

  return (
    <footer className="space-y-2 rounded-2xl border border-white bg-white/85 p-3 shadow-[0_10px_35px_#26355913] sm:p-4">
      <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-[#d9dfe9] bg-white p-1.5 focus-within:border-[#6d88a6]">
        <label htmlFor="bolo-command" className="sr-only">Bill ya sawaal likho</label>
        <input id="bolo-command" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500}
          disabled={micDisabled || busy} autoComplete="off" placeholder="Bill ya sawaal likho…"
          className="min-w-0 flex-1 px-2 text-sm outline-none placeholder:text-[#67748b] disabled:opacity-60 sm:text-base" />
        <button type="submit" disabled={micDisabled || busy || !input.trim()}
          className="min-h-10 rounded-lg bg-[#253953] px-3 text-sm font-semibold text-white hover:bg-[#344f70] disabled:opacity-45">
          Bhejo
        </button>
      </form>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
        <button type="button" onClick={onLikho} disabled={busy} className="flex min-h-11 items-center gap-1.5 justify-self-start rounded-xl px-2 text-sm font-semibold text-[#344761] hover:bg-[#eaf0f7] disabled:opacity-45">
          <KeyboardIcon className="size-5" /> Likho
        </button>
        <MicButton disabled={micDisabled} onStart={onStart} onWords={onWords} onFinish={onFinish} />
        <button type="button" onClick={action.run} disabled={action.disabled || busy}
          className={`min-h-11 rounded-xl px-2 py-2 text-sm font-semibold text-white disabled:opacity-40 ${action.tone === "danger" ? "bg-red" : "bg-[#253953] hover:bg-[#344f70]"}`}>
          {action.label}
        </button>
      </div>
      {hint && <p className="text-center text-xs text-[#55667c]">{hint}</p>}
    </footer>
  );
}
