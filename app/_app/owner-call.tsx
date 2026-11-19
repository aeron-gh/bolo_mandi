"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

// The server said this needs the owner's PIN.
export class PinNeeded extends Error {
  constructor() {
    super("PIN chahiye");
  }
}

// JSON call to our API. 401 pin_required -> PinNeeded; a lost login goes back to /login.
export async function ownerFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new Error("No internet. Please try again.");
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && data.error === "pin_required") throw new PinNeeded();
  if (res.status === 401) {
    window.location.replace("/login");
    throw new Error("Please log in");
  }
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

// Run an owner action; if the shop is locked, ask for the PIN once and try again.
export function useOwnerCall() {
  const [asking, setAsking] = useState(false);
  const answer = useRef<((unlocked: boolean) => void) | null>(null);

  async function run<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (!(error instanceof PinNeeded)) throw error;
      const unlocked = await new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setAsking(true);
      });
      if (!unlocked) throw new Error("Not changed: the owner PIN is needed");
      return task();
    }
  }

  function done(unlocked: boolean) {
    setAsking(false);
    answer.current?.(unlocked);
    answer.current = null;
  }

  return { run, prompt: <PinPrompt open={asking} onDone={done} /> };
}

// A small modal box asking for the PIN. Esc or "Not now" says no.
function PinPrompt({ open, onDone }: { open: boolean; onDone: (unlocked: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const box = dialog.current;
    if (open && box && !box.open) box.showModal();
    if (!open && box?.open) box.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await ownerFetch("/api/session", "POST", { pin: String(new FormData(form).get("pin") ?? "") });
      form.reset();
      onDone(true);
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="pin-title" onCancel={(e) => { e.preventDefault(); onDone(false); }}>
      <form className="dialog-body" onSubmit={submit}>
        <h2 id="pin-title">Owner PIN</h2>
        <p className="panel-note">Only the owner can make this change. You won&apos;t be asked again for 12 hours.</p>
        <input className="input pin-input" name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6}
          autoComplete="off" required aria-label="PIN" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={() => onDone(false)}>Not now</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Checking…" : "Unlock"}</button>
        </div>
      </form>
    </dialog>
  );
}
