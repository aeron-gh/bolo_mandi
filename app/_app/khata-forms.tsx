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
  if (!paise) throw new Error("Enter a valid amount, like 1500 or 250.50");
  return paise;
}

const amountInput = (label = "Amount (₹)") => (
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
        <Link href={`/app?customer=${customer.id}`} className="btn btn-primary">New bill</Link>
        <button type="button" className="btn btn-outline" onClick={show("payment")}>Record payment</button>
        <button type="button" className="btn btn-outline" onClick={show("promise")}>Record promise</button>
        <button type="button" className="btn btn-outline" onClick={show("adjustment")}>Correction</button>
        <button type="button" className="btn btn-outline" onClick={show("edit")}>Edit</button>
      </div>
      {done && <p className="form-ok" role="status">{done}</p>}
      <FormDialog open={open === "payment"} title={`Payment from ${customer.name}`} onClose={() => setOpen(null)}>
        <PaymentForm customerId={customer.id} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "promise"} title={`Promise from ${customer.name}`} onClose={() => setOpen(null)}>
        <PromiseForm customerId={customer.id} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "adjustment"} title="Add a correction" onClose={() => setOpen(null)}>
        <AdjustmentForm customerId={customer.id} run={owner.run} onDone={finish} />
      </FormDialog>
      <FormDialog open={open === "edit"} title={`Edit ${customer.name}`} onClose={() => setOpen(null)}>
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
    onDone(`Payment of ${formatRupees(result.amount)} recorded. Credit is now ${formatRupees(result.newOutstanding)}.`);
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
        <legend>Paid how?</legend>
        <label><input type="radio" name="mode" value="cash" /> Cash</label>
        <label><input type="radio" name="mode" value="upi" /> UPI</label>
        <label><input type="radio" name="mode" value="" /> Not said</label>
      </fieldset>
      {extra ? (
        <div className="ask-box" role="alert">
          <p>This is {formatRupees(extra.paise)} more than the credit. Keep the extra as advance?</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void keepAdvance()}>Yes, keep as advance</button>
            <button type="button" className="btn btn-outline" onClick={() => setExtra(null)}>Change amount</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Record payment"}</button>
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
    if (!due) throw new Error("Pick a date.");
    const result = await ownerFetch<PromiseResult>("/api/promises", "POST", { draftId: draft.get(), customerId, amount: amountFrom(fields.amount), due });
    draft.reset();
    form.reset();
    setWhen("kal");
    onDone(`Promise of ${formatRupees(result.amount)} by ${result.dueDate} recorded.`);
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      {amountInput()}
      <label className="field">Will pay by
        <select className="input" value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="aaj">Today</option>
          <option value="kal">Tomorrow</option>
          <option value="parso">Day after tomorrow</option>
          <option value="date">Pick a date</option>
        </select>
      </label>
      {when === "date" && <label className="field">Date<input className="input" type="date" name="date" required /></label>}
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Record promise"}</button>
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
    onDone(`Correction recorded. Credit is now ${formatRupees(result.newOutstanding)}.`);
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <p className="panel-note">Old lines never change. A new line is added with the reason.</p>
      <fieldset className="choice-row">
        <legend>Credit</legend>
        <label><input type="radio" name="direction" value="minus" defaultChecked /> Reduce</label>
        <label><input type="radio" name="direction" value="plus" /> Increase</label>
      </fieldset>
      {amountInput()}
      <label className="field">Reason
        <textarea className="input textarea" name="note" required maxLength={120} rows={2} placeholder="Wrong rate on the last bill" />
      </label>
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Save correction"}</button>
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// Name and phone are everyday fixes; a new credit limit asks for the owner's PIN.
function EditForm({ customer, phone, creditLimit, run, onDone }: Props & { run: Run; onDone: (message: string) => void }) {
  const { onSubmit, status, busy } = useSubmit(async (fields) => {
    const limit = parseRupees(fields.limit ?? "");
    if (limit === null || limit % 100 !== 0) throw new Error("Enter the limit in whole rupees.");
    await run(() => ownerFetch<Account>(`/api/customers/${customer.id}`, "PATCH", { name: fields.name, phone: fields.phone, creditLimit: limit }));
    onDone("Customer details saved.");
    return "";
  });
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label className="field">Name<input className="input" name="name" defaultValue={customer.name} required maxLength={60} /></label>
      <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" defaultValue={phone} placeholder="98765 43210" /></label>
      <label className="field">Credit limit (₹)
        <input className="input" name="limit" inputMode="numeric" defaultValue={creditLimit / 100} required />
        <span className="field-hint">Changing the limit asks for the owner PIN.</span>
      </label>
      <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
      {status?.text && <StatusLine value={status} />}
    </form>
  );
}

// "Paid" or "Not paid" for one open promise.
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
      <button type="button" className="btn btn-soft btn-sm" onClick={() => void mark("kept")}>Paid</button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => void mark("broken")}>Not paid</button>
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
    if (limit === null || limit % 100 !== 0) throw new Error("Enter the limit in whole rupees.");
    const customer = await owner.run(() => ownerFetch<Customer>("/api/customers", "POST", { name: fields.name, phone: fields.phone, creditLimit: limit }));
    router.push(`/app/customers/${customer.id}`);
    return "";
  });
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>New customer</button>
      <FormDialog open={open} title="New customer" onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={onSubmit}>
          <label className="field">Name<input className="input" name="name" required maxLength={60} /></label>
          <label className="field">Mobile<input className="input" name="phone" type="tel" inputMode="tel" placeholder="98765 43210" /></label>
          <label className="field">Credit limit (₹)
            <input className="input" name="limit" inputMode="numeric" defaultValue="0" />
            <span className="field-hint">₹0 means cash only. A higher limit asks for the owner PIN.</span>
          </label>
          <button className="btn btn-primary justify-self-start" disabled={busy}>{busy ? "Saving…" : "Add customer"}</button>
          {status?.text && <StatusLine value={status} />}
        </form>
      </FormDialog>
      {owner.prompt}
    </>
  );
}
