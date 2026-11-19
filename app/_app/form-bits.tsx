"use client";
// Small pieces every form in the app shares: submit state, a status line, a modal box, one draft id per form.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { newDraftId } from "@/lib/draft.ts";
import { messageOf } from "./owner-call.tsx";

export type Status = { ok: boolean; text: string } | null;

export function StatusLine({ value }: { value: Status }) {
  if (!value) return null;
  return <p className={value.ok ? "form-ok" : "form-error"} role={value.ok ? "status" : "alert"}>{value.text}</p>;
}

// Busy flag, a status line, and the form's fields as a plain object. The work returns the success text.
export function useSubmit(work: (fields: Record<string, string>, form: HTMLFormElement) => Promise<string>) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)]));
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ ok: true, text: await work(fields, form) });
    } catch (error) {
      setStatus({ ok: false, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }
  return { onSubmit, status, setStatus, busy };
}

// One id per form until it saves, so a double tap or a retry writes only once.
export function useDraftId() {
  const id = useRef<string | null>(null);
  return {
    get: () => (id.current ??= newDraftId()),
    reset: () => {
      id.current = null;
    },
  };
}

// A modal box for one form. Esc and "Band karo" close it.
export function FormDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = box.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={box} className="dialog dialog-wide" aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dialog-body">
        <div className="dialog-title">
          <h2>{title}</h2>
          <button type="button" className="text-link" onClick={onClose}>Band karo</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
