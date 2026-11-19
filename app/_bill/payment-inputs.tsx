"use client";
// Money received now. Whatever is left becomes udhaar on the slip.
import type { Dispatch } from "react";
import type { Action } from "@/lib/draft.ts";
import { rs } from "@/lib/money.ts";
import { wholeNumber } from "./api-client.ts";

type Props = { cash: number; upi: number; disabled: boolean; dispatch: Dispatch<Action> };

export function PaymentInputs({ cash, upi, disabled, dispatch }: Props) {
  return (
    <section aria-labelledby="payment-heading">
      <h2 id="payment-heading" className="text-lg font-semibold">Payment</h2>
      <p className="text-sm text-muted">Jo abhi mila, woh likho. Baaki udhaar mein jayega.</p>
      <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
        <MoneyField label="Cash" value={cash} disabled={disabled} onChange={(p) => dispatch({ type: "setPayment", cash: p })} />
        <MoneyField label="UPI" value={upi} disabled={disabled} onChange={(p) => dispatch({ type: "setPayment", upi: p })} />
      </div>
    </section>
  );
}

type FieldProps = { label: string; value: number; disabled: boolean; onChange: (paise: number) => void };

function MoneyField({ label, value, disabled, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className={`mt-1 flex h-14 items-center rounded-lg border border-rule outline-brand focus-within:outline-2 ${disabled ? "bg-ground text-muted" : ""}`}>
        <span className="pl-3 text-lg text-muted">₹</span>
        <input
          inputMode="numeric"
          value={value ? String(value / 100) : ""}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => {
            const n = wholeNumber(e.target.value);
            if (e.target.value === "") onChange(0);
            else if (n !== null) onChange(rs(n));
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-2xl tabular-nums outline-none"
        />
      </span>
    </label>
  );
}
