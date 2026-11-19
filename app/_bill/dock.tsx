"use client";
import { useState, type FormEvent } from "react";
import { Icon, KeyboardIcon } from "./icons.tsx";

type Props = {
  busy: boolean;
  micDisabled: boolean;
  onType: (text: string) => void;
  onLikho: () => void;
};

export function Dock({ busy, micDisabled, onType, onLikho }: Props) {
  const [input, setInput] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (micDisabled || busy || !input.trim()) return;
    onType(input.trim());
    setInput("");
  }

  return (
    <footer className="composer-wrap">
      <form onSubmit={submit} className="composer">
        <button type="button" onClick={onLikho} disabled={busy} className="manual-entry">
          <KeyboardIcon className="size-5" /> Add items
        </button>
        <label htmlFor="bolo-command" className="sr-only">Type a bill or a question</label>
        <input id="bolo-command" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500}
          disabled={micDisabled || busy} autoComplete="off" placeholder="Type a bill or a question…" />
        <button type="submit" aria-label="Send" title="Send" disabled={micDisabled || busy || !input.trim()} className="send-button">
          <Icon name="send" />
        </button>
      </form>
    </footer>
  );
}
