"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { User } from "@/lib/accounts.ts";
import type { Grade, RateCard } from "@/lib/billing.ts";
import { rs } from "@/lib/money.ts";
import type { Shop } from "@/lib/shop.ts";
import { forgetDraft } from "@/app/_bill/draft-store.ts";
import { Icon } from "@/app/_bill/icons.tsx";
import { StatusLine, useSubmit, type Status } from "./form-bits.tsx";
import { messageOf, ownerFetch, PinNeeded, useOwnerCall } from "./owner-call.tsx";

type Run = <T>(task: () => Promise<T>) => Promise<T>;
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

export function ProfileForms({ shop, rates, demo, user, draftKey }: Props) {
  const owner = useOwnerCall();
  return (
    <main className="page page-narrow">
      <header className="page-head">
        <h1>Profile</h1>
        <p>Shop details, rate list and owner PIN.</p>
      </header>
      <div className="settings">
        <ShopPanel shop={shop} run={owner.run} />
        <RatesPanel rates={rates} run={owner.run} />
        <PinPanel demo={demo} hasPin={shop.hasPin} run={owner.run} />
        {!demo && <BackupPanel run={owner.run} />}
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
    <SettingRow title="Account" note={demo ? "This demo shop is shared by everyone. Keep your real accounts in your own account." : "Signed in on this device."}>
      {demo ? (
        <>
          <div className="btn-row">
            <Link href="/signup" className="btn btn-primary">Create account</Link>
            <Link href="/login" className="btn btn-outline">Login</Link>
          </div>
          <button type="button" className="btn btn-soft justify-self-start" onClick={() => void act("/api/demo/reset", () => {
            setStatus({ ok: true, text: "Demo shop reset." });
            router.refresh();
          })}>Reset demo shop</button>
        </>
      ) : (
        <>
          <p><strong>{user?.name}</strong><br /><span className="panel-note">{user?.email}</span></p>
          <button type="button" className="btn btn-outline justify-self-start" onClick={() => void act("/api/auth/logout", () => router.replace("/login"))}>
            <Icon name="logout" /> Logout
          </button>
        </>
      )}
      <Link href="/help" className="text-link">What Bolo understands</Link>
      <StatusLine value={status} />
    </SettingRow>
  );
}

function ShopPanel({ shop, run }: { shop: Shop; run: Run }) {
  const router = useRouter();
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    await run(() => ownerFetch("/api/shop", "PUT", fields));
    router.refresh();
    return "Shop details saved.";
  });
  return (
    <SettingRow title="Shop" note="This name, number and address are printed on bills and WhatsApp receipts.">
      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">Shop name<input className="input" name="shopName" defaultValue={shop.shopName} maxLength={60} /></label>
        <label className="field">Owner name<input className="input" name="ownerName" defaultValue={shop.ownerName} maxLength={60} /></label>
        <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" defaultValue={shop.phone} placeholder="98765 43210" /></label>
        <label className="field">Address<textarea className="input textarea" name="address" defaultValue={shop.address} maxLength={160} rows={2} /></label>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Save shop details"}</button>
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
      if (!/^\d+$/.test(text)) throw new Error(`Enter the grade ${grade} rate in whole rupees.`);
      paise[grade] = rs(Number(text));
    }
    await run(() => ownerFetch("/api/rates", "PUT", paise));
    router.refresh();
    return "Rates saved. They apply from the next bill.";
  });
  return (
    <SettingRow title="Rate list" note="Price per piece, in whole rupees. A rate spoken while billing takes priority.">
      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-row">
          {GRADES.map((grade) => (
            <label key={grade} className="field">Grade {grade}
              <input className="input" name={`grade${grade}`} inputMode="numeric" defaultValue={rates[grade] / 100} required />
            </label>
          ))}
        </div>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Save rates"}</button>
      </form>
    </SettingRow>
  );
}

function PinPanel({ demo, hasPin, run }: { demo: boolean; hasPin: boolean; run: Run }) {
  const router = useRouter();
  const { onSubmit, status, busy } = useSubmit(async (fields, form) => {
    if (fields.pin !== fields.repeat) throw new Error("The two PINs do not match.");
    const body = hasPin ? { pin: fields.pin, currentPin: fields.currentPin } : { pin: fields.pin };
    await run(() => ownerFetch("/api/pin", "POST", body));
    form.reset();
    router.refresh();
    return hasPin ? "PIN changed." : "PIN set. Bolo will now ask for it before shop, rate or limit changes.";
  });
  const [lockNote, setLockNote] = useState<Status>(null);

  if (demo) {
    return (
      <SettingRow title="Owner PIN" note="Everyone uses the demo shop, so it has no PIN.">
        <p className="panel-note">In your own account, a PIN protects your rates, shop details and limits.</p>
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
    <SettingRow title="Owner PIN" note={hasPin ? "Bolo asks for the PIN before changes to shop details, rates, limits and backups."
      : "No PIN yet, so anyone at the counter can change your rates. Set a 4 to 6 digit PIN."}>
      <form className="form-stack" onSubmit={onSubmit}>
        {hasPin && pinInput("currentPin", "Current PIN")}
        <div className="form-row form-row-2">
          {pinInput("pin", hasPin ? "New PIN" : "PIN")}
          {pinInput("repeat", "Repeat PIN")}
        </div>
        <StatusLine value={status} />
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : hasPin ? "Change PIN" : "Set PIN"}</button>
      </form>
      {hasPin && (
        <button type="button" className="btn btn-outline justify-self-start" onClick={async () => {
          try {
            await ownerFetch("/api/session", "DELETE");
            setLockNote({ ok: true, text: "Locked. The next change will ask for the PIN." });
          } catch (error) {
            setLockNote({ ok: false, text: messageOf(error) });
          }
        }}><Icon name="lock" /> Lock now</button>
      )}
      <StatusLine value={lockNote} />
    </SettingRow>
  );
}

// Download a copy of the whole shop. Owner only once a PIN is set, so it goes through the PIN check.
function BackupPanel({ run }: { run: Run }) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setStatus(null);
    try {
      const file = await run(async () => {
        const res = await fetch("/api/backup");
        if (res.ok) return res.blob();
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 401 && data.error === "pin_required") throw new PinNeeded();
        throw new Error(data.error ?? "Backup failed. Please try again.");
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = `bolo-backup-${new Date().toISOString().slice(0, 10)}.db`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus({ ok: true, text: "Backup downloaded. Keep it on a pen drive or in Google Drive." });
    } catch (error) {
      setStatus({ ok: false, text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingRow title="Backup" note="A backup is made automatically every day and the last 14 are kept. You can download a full copy of your shop any time.">
      <button type="button" className="btn btn-outline justify-self-start" onClick={() => void download()} disabled={busy}>
        {busy ? "Preparing…" : "Download backup"}
      </button>
      <StatusLine value={status} />
    </SettingRow>
  );
}
