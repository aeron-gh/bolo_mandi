"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "signup";

// POST the form as JSON; null means it worked, otherwise the message to show.
async function send(url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return "Internet nahi hai. Dobara try karein.";
  if (res.ok) return null;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Kuch gadbad hui. Dobara try karein.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const problem = await send(`/api/auth/${mode}`, Object.fromEntries(new FormData(event.currentTarget)));
    if (problem === null) return router.replace("/app");
    setError(problem);
    setBusy(false);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "signup" && (
        <>
          <label className="field">Aapka naam<input className="input" name="name" autoComplete="name" required maxLength={60} /></label>
          <label className="field">Dukaan ka naam<input className="input" name="shopName" autoComplete="organization" maxLength={60} /></label>
        </>
      )}
      <label className="field">Email<input className="input" name="email" type="email" autoComplete="email" required maxLength={120} /></label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {mode === "signup" && <span className="field-hint">Kam se kam 8 akshar</span>}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Ruko…" : mode === "login" ? "Login" : "Account banao"}
      </button>
    </form>
  );
}

// Skip login: the shared demo shop with the sample customers.
export function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    const problem = await send("/api/auth/demo", {});
    if (problem === null) return router.replace("/app");
    setError(problem);
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn btn-soft btn-block" onClick={start} disabled={busy}>
        {busy ? "Ruko…" : "Bina login demo dekhein"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
