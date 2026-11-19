"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Account, Customer } from "@/lib/customers.ts";
import type { AdjustmentResult, PaymentResult, PromiseResult } from "@/lib/ledger.ts";
import { formatRupees, parseRupees } from "@/lib/money.ts";
import { FormDialog, StatusLine, useDraftId, useSubmit } from "./form-bits.tsx";
import { messageOf, ownerFetch, useOwnerCall } from "./owner-call.tsx";

type Run = <T>(task: () => Promise<T>) => Promise<T>;
type Kind = "payment" | "promise" | "adjustment" | "edit" | null;
type Props = { customer: Customer; phone: string; creditLimit: number };

function amountFrom(text: string | undefined): number {
  const paise = parseRupees(text ?? "");
  if (!paise) throw new Error("Rakam sahi likho, jaise 1500 ya 250.50");
  return paise;
}

const amountInput = (label = "Rakam (₹)") => (
  <label className="field">{label}
    <input className="input" name="amount" inputMode="decimal" autoComplete="off" required placeholder="1500" />
  </label>
);

// The buttons on a customer's khata and the form each one opens.
export function KhataActions({ customer, phone, creditLimit }: Props) {
  const router = useRouter();
  const owner = useOwnerCall();
  const [open, setOpen] = useState<Kind>(null);
  const [done, setDone] = useState<string | null>(null);

  function finish(message: string) {
    setOpen(null);
    setDone(message);
    router.refresh();
  }

  const show = (kind: Kind) => () => {
    setDone(null);
    setOpen(kind);
  };

  return (
    <>
      <div className="khata-actions">
        <Link href={`/app?customer=${customer.id}`} className="btn btn-primary">Naya bill</Link>
        <button type="button" className="btn btn-outline" onClick={show("payment")}>Vasooli likho</button>
        <button type="button" className="btn btn-outline" onClick={show("promise")}>Vaada likho</button>
        <button type="button" className="btn btn-outline" onClick={show("adjustment")}>Sudhaar</button>
        <button type="button" className="btn btn-outline" onClick={show("edit")}>Badlo</button>
      </div>
      {done && <p className="form-ok" role="status">{done}</p>}
      <FormDialog open={open === "payment"} title={`${customer.name} se vasooli`} onClose={() => setOpen(null)}>
        <PaymentForm customerId={customer.id} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "promise"} title={`${customer.name} ka vaada`} onClose={() => setOpen(null)}>
        <PromiseForm customerId={customer.id} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "adjustment"} title="Sudhaar likho" onClose={() => setOpen(null)}>
        <AdjustmentForm customerId={customer.id} run={owner.run} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "edit"} title={`${customer.name} ki jaankari`} onClose={() => setOpen(null)}>
        <EditForm customer={customer} phone={phone} creditLimit={creditLimit} run={owner.run} onDone={finish} />
      </FormDialog>
      {owner.prompt}
    </>
  );
}

// Vasooli: mode is never guessed. More than what is owed asks before keeping it as advance.
function PaymentForm({ customerId, onDone }: { customerId: number; onDone: (message: string) => void }) {
  const draft = useDraftId();
  const [extra, setExtra] = useState<{ paise: number; body: Record<string, unknown>; form: HTMLFormElement } | null>(null);

  function saved(result: PaymentResult, form: HTMLFormElement): string {
    if (result.status !== "saved") return "";
    draft.reset();
    form.reset();
    setExtra(null);
    onDone(`${formatRupees(result.amount)} vasooli likhi. Ab udhaar ${formatRupees(result.newOutstanding)}.`);
    return "";
  }

  const { onSubmit, status, setStatus, busy } = useSubmit(async (fields, form) => {
    const mode = fields.mode === "cash" || fields.mode === "upi" ? fields.mode : null;
    const body = { draftId: draft.get(), customerId, amount: amountFrom(fields.amount), mode };
    const result = await ownerFetch<PaymentResult>("/api/payments", "POST", body);
    if (result.status === "needs_answer") {
      setExtra({ paise: result.extra, body, form });
      return "";
    }
    return saved(result, form);
  });

  async function keepAdvance() {
    if (!extra) return;
    try {
      saved(await ownerFetch<PaymentResult>("/api/payments", "POST", { ...extra.body, allowAdvance: true }), extra.form);
    } catch (error) {
      setStatus({ ok: false, text: messageOf(error) });
    }
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      {amountInput()}
      <fieldset className="choice-row">
        <legend>Kaise mila?</legend>
        <label><input type="radio" name="mode" value="cash" /> Cash</label>
        <label><input type="radio" name="mode" value="upi" /> UPI</label>
        <label><input type="radio" name="mode" value="" /> Nahi bataya</label>
      </fieldset>
      {extra ? (
        <div className="ask-box" role="alert">
          <p>Yeh udhaar se {formatRupees(extra.paise)} zyada hai. Advance rakhna hai?</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void keepAdvance()}>Haan, advance rakho</button>
            <button type="button" className="btn btn-outline" onClick={() => setExtra(null)}>Rakam badlo</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Vasooli likho"}</button>
      )}
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// A promise never changes the udhaar; it only reminds the owner.
function PromiseForm({ customerId, onDone }: { customerId: number; onDone: (message: string) => void }) {
  const draft = useDraftId();
  const [when, setWhen] = useState("kal");
  const { onSubmit, status, busy } = useSubmit(async (fields, form) => {
    const due = when === "date" ? fields.date : when;
    if (!due) throw new Error("Taarikh chuno.");
    const result = await ownerFetch<PromiseResult>("/api/promises", "POST", { draftId: draft.get(), customerId, amount: amountFrom(fields.amount), due });
    draft.reset();
    form.reset();
    setWhen("kal");
    onDone(`${formatRupees(result.amount)} ka vaada ${result.dueDate} tak likha.`);
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      {amountInput()}
      <label className="field">Kab dega?
        <select className="input" value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="aaj">Aaj</option>
          <option value="kal">Kal</option>
          <option value="parso">Parso</option>
          <option value="date">Taarikh chuno</option>
        </select>
      </label>
      {when === "date" && <label className="field">Taarikh<input className="input" type="date" name="date" required /></label>}
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Vaada likho"}</button>
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// A mistake is fixed by a new line with a reason, never by changing an old one. Owner only.
function AdjustmentForm({ customerId, run, onDone }: { customerId: number; run: Run; onDone: (message: string) => void }) {
  const draft = useDraftId();
  const { onSubmit, status, busy } = useSubmit(async (fields, form) => {
    const amount = amountFrom(fields.amount) * (fields.direction === "minus" ? -1 : 1);
    const body = { draftId: draft.get(), customerId, amount, note: fields.note ?? "" };
    const result = await run(() => ownerFetch<AdjustmentResult>("/api/adjustments", "POST", body));
    draft.reset();
    form.reset();
    onDone(`Sudhaar likha. Ab udhaar ${formatRupees(result.newOutstanding)}.`);
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <p className="panel-note">Purani line nahi badalti. Ek nayi line judti hai jismein wajah likhi hoti hai.</p>
      <fieldset className="choice-row">
        <legend>Udhaar</legend>
        <label><input type="radio" name="direction" value="minus" defaultChecked /> Ghatao</label>
        <label><input type="radio" name="direction" value="plus" /> Badhao</label>
      </fieldset>
      {amountInput()}
      <label className="field">Wajah
        <textarea className="input textarea" name="note" required maxLength={120} rows={2} placeholder="Pichle bill mein rate galat laga" />
      </label>
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Sudhaar likho"}</button>
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// Name and phone are everyday fixes; a new credit limit asks for the owner's PIN.
function EditForm({ customer, phone, creditLimit, run, onDone }: Props & { run: Run; onDone: (message: string) => void }) {
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    const limit = parseRupees(fields.limit ?? "");
    if (limit === null || limit % 100 !== 0) throw new Error("Limit poore rupaye mein likho.");
    await run(() => ownerFetch<Account>(`/api/customers/${customer.id}`, "PATCH", { name: fields.name, phone: fields.phone, creditLimit: limit }));
    onDone("Jaankari save ho gayi.");
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label className="field">Naam<input className="input" name="name" defaultValue={customer.name} required maxLength={60} /></label>
      <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" defaultValue={phone} placeholder="98765 43210" /></label>
      <label className="field">Credit limit (₹)
        <input className="input" name="limit" inputMode="numeric" defaultValue={creditLimit / 100} required />
        <span className="field-hint">Limit badalne par owner PIN poocha jayega.</span>
      </label>
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Jaankari save karo"}</button>
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// "Mil gaya" or "Nahi mila" for one open promise.
export function PromiseButtons({ id }: { id: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function mark(status: "kept" | "broken") {
    try {
      await ownerFetch(`/api/promises/${id}`, "PATCH", { status });
      router.refresh();
    } catch (problem) {
      setError(messageOf(problem));
    }
  }
  return (
    <span className="promise-buttons">
      <button type="button" className="btn btn-soft btn-sm" onClick={() => void mark("kept")}>Mil gaya</button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => void mark("broken")}>Nahi mila</button>
      {error && <span className="form-error">{error}</span>}
    </span>
  );
}

// "Naya customer" on the khata list. A limit above ₹0 asks for the owner's PIN.
export function NewCustomerButton() {
  const router = useRouter();
  const owner = useOwnerCall();
  const [open, setOpen] = useState(false);
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    const limit = parseRupees(fields.limit || "0");
    if (limit === null || limit % 100 !== 0) throw new Error("Limit poore rupaye mein likho.");
    const customer = await owner.run(() => ownerFetch<Customer>("/api/customers", "POST", { name: fields.name, phone: fields.phone, creditLimit: limit }));
    router.push(`/app/customers/${customer.id}`);
    return "";
  });
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Naya customer</button>
      <FormDialog open={open} title="Naya customer" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={onSubmit}>
          <label className="field">Naam<input className="input" name="name" required maxLength={60} /></label>
          <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" placeholder="98765 43210" /></label>
          <label className="field">Credit limit (₹)
            <input className="input" name="limit" inputMode="numeric" defaultValue="0" />
            <span className="field-hint">₹0 matlab sirf nakad. Zyada limit par owner PIN poocha jayega.</span>
          </label>
          <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Ruko…" : "Customer jodo"}</button>
          {status?.text && <StatusLine value={status} />}
        </form>
      </FormDialog>
      {owner.prompt}
    </>
  );
}
