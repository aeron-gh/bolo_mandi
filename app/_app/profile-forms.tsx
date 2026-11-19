"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@/lib/accounts.ts";
import type { Grade, RateCard } from "@/lib/billing.ts";
import { rs } from "@/lib/money.ts";
import type { Shop } from "@/lib/shop.ts";
import { forgetDraft } from "@/app/_bill/draft-store.ts";
import { Icon } from "@/app/_bill/icons.tsx";
import { messageOf, ownerFetch, useOwnerCall } from "./owner-call.tsx";

type Run = <T>(task: () => Promise<T>) => Promise<T>;
type Status = { ok: boolean; text: string } | null;
type Props = { shop: Shop; rates: RateCard; demo: boolean; user: User | null; draftKey: string };

const GRADES: Grade[] = [1, 2, 3];

// One row of the settings sheet: what it is on the left, the controls on the right.
function SettingRow({ title, note, children }: { title: string; note: ReactNode; children: ReactNode }) {
  return (
    <section className="setting">
      <div className="setting-label">
        <h2>{title}</h2>
        <p>{note}</p>
      </div>
      <div className="setting-body">{children}</div>
    </section>
  );
}

function StatusLine({ value }: { value: Status }) {
  if (!value) return null;
  return <p className={value.ok ? "form-ok" : "form-error"} role={value.ok ? "status" : "alert"}>{value.text}</p>;
}

// Submit helper: busy flag, a status line, and the form's fields as a plain object.
function useSubmit(work: (fields: Record<string, string>, form: HTMLFormElement) => Promise<string>) {
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
  return { onSubmit, status, busy };
}

export function ProfileForms({ shop, rates, demo, user, draftKey }: Props) {
  const owner = useOwnerCall();
  return (
    <main className="page page-narrow">
      <header className="page-head">
        <h1>Profile</h1>
        <p>Dukaan ki jaankari, rate list aur PIN.</p>
      </header>
      <div className="settings">
        <ShopPanel shop={shop} run={owner.run} />
        <RatesPanel rates={rates} run={owner.run} />
        <PinPanel demo={demo} hasPin={shop.hasPin} run={owner.run} />
        <AccountPanel demo={demo} user={user} draftKey={draftKey} />
      </div>
      {owner.prompt}
    </main>
  );
}

function AccountPanel({ demo, user, draftKey }: { demo: boolean; user: User | null; draftKey: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);

  async function act(url: string, after: () => void) {
    setStatus(null);
    try {
      await ownerFetch(url, "POST", {});
      forgetDraft(draftKey);
      after();
    } catch (error) {
      setStatus({ ok: false, text: messageOf(error) });
    }
  }

  return (
    <SettingRow title="Account" note={demo ? "Yeh demo dukaan sab ke liye ek hai. Asli hisaab apne account mein rakhein." : "Is device se login."}>
      {demo ? (
        <>
          <div className="btn-row">
            <Link href="/signup" className="btn btn-primary">Account banao</Link>
            <Link href="/login" className="btn btn-outline">Login</Link>
          </div>
          <button type="button" className="btn btn-soft justify-self-start" onClick={() => void act("/api/demo/reset", () => {
            setStatus({ ok: true, text: "Demo reset ho gayi." });
            router.refresh();
          })}>Demo reset karo</button>
        </>
      ) : (
        <>
          <p><strong>{user?.name}</strong><br /><span className="panel-note">{user?.email}</span></p>
          <button type="button" className="btn btn-outline justify-self-start" onClick={() => void act("/api/auth/logout", () => router.replace("/login"))}>
            <Icon name="logout" /> Logout
          </button>
        </>
      )}
      <Link href="/help" className="text-link">Bolo kya kya samajhta hai</Link>
      <StatusLine value={status} />
    </SettingRow>
  );
}

function ShopPanel({ shop, run }: { shop: Shop; run: Run }) {
  const router = useRouter();
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    await run(() => ownerFetch("/api/shop", "PUT", fields));
    router.refresh();
    return "Dukaan save ho gayi.";
  });
  return (
    <SettingRow title="Dukaan" note="Bill aur WhatsApp parchi par yahi naam, number aur pata chhapega.">
      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">Dukaan ka naam<input className="input" name="shopName" defaultValue={shop.shopName} maxLength={60} /></label>
        <label className="field">Owner ka naam<input className="input" name="ownerName" defaultValue={shop.ownerName} maxLength={60} /></label>
        <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" defaultValue={shop.phone} placeholder="98765 43210" /></label>
        <label className="field">Pata<textarea className="input textarea" name="address" defaultValue={shop.address} maxLength={160} rows={2} /></label>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Dukaan save karo"}</button>
      </form>
    </SettingRow>
  );
}

function RatesPanel({ rates, run }: { rates: RateCard; run: Run }) {
  const router = useRouter();
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    const paise = {} as RateCard;
    for (const grade of GRADES) {
      const text = (fields[`grade${grade}`] ?? "").trim();
      if (!/^\d+$/.test(text)) throw new Error(`Grade ${grade} ka rate poore rupaye mein likho.`);
      paise[grade] = rs(Number(text));
    }
    await run(() => ownerFetch("/api/rates", "PUT", paise));
    router.refresh();
    return "Rate save ho gaye. Agle bill se lagenge.";
  });
  return (
    <SettingRow title="Rate list" note="Ek piece ka rate, poore rupaye mein. Bill banate waqt bola gaya rate isse upar rehta hai.">
      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-row">
          {GRADES.map((grade) => (
            <label key={grade} className="field">Grade {grade}
              <input className="input" name={`grade${grade}`} inputMode="numeric" defaultValue={rates[grade] / 100} required />
            </label>
          ))}
        </div>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Rate save karo"}</button>
      </form>
    </SettingRow>
  );
}

function PinPanel({ demo, hasPin, run }: { demo: boolean; hasPin: boolean; run: Run }) {
  const router = useRouter();
  const { onSubmit, status, busy } = useSubmit(async (fields, form) => {
    if (fields.pin !== fields.repeat) throw new Error("Dono PIN ek jaise nahi hain.");
    const body = hasPin ? { pin: fields.pin, currentPin: fields.currentPin } : { pin: fields.pin };
    await run(() => ownerFetch("/api/pin", "POST", body));
    form.reset();
    router.refresh();
    return hasPin ? "PIN badal gaya." : "PIN lag gaya. Ab dukaan, rate aur limit badalne se pehle PIN poocha jayega.";
  });
  const [lockNote, setLockNote] = useState<Status>(null);

  if (demo) {
    return (
      <SettingRow title="Owner PIN" note="Demo dukaan sab use karte hain, isliye yahan PIN nahi lagta.">
        <p className="panel-note">Apne account mein PIN lagakar rate, dukaan aur limit ko surakshit rakhiye.</p>
      </SettingRow>
    );
  }

  const pinInput = (name: string, label: string) => (
    <label className="field">{label}
      <input className="input" name={name} type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} required
        autoComplete={name === "currentPin" ? "current-password" : "new-password"} />
    </label>
  );

  return (
    <SettingRow title="Owner PIN" note={hasPin ? "Dukaan, rate, limit aur backup badalne se pehle PIN poocha jata hai."
      : "Abhi PIN nahi hai, isliye counter par koi bhi rate badal sakta hai. 4 se 6 ank ka PIN lagaiye."}>
      <form className="form-stack" onSubmit={onSubmit}>
        {hasPin && pinInput("currentPin", "Abhi ka PIN")}
        <div className="form-row form-row-2">
          {pinInput("pin", hasPin ? "Naya PIN" : "PIN")}
          {pinInput("repeat", "Dobara likho")}
        </div>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : hasPin ? "PIN badlo" : "PIN lagao"}</button>
      </form>
      {hasPin && (
        <button type="button" className="btn btn-outline justify-self-start" onClick={async () => {
          try {
            await ownerFetch("/api/session", "DELETE");
            setLockNote({ ok: true, text: "Lock ho gaya. Agla badlav PIN maangega." });
          } catch (error) {
            setLockNote({ ok: false, text: messageOf(error) });
          }
        }}><Icon name="lock" /> Abhi lock karo</button>
      )}
      <StatusLine value={lockNote} />
    </SettingRow>
  );
}
