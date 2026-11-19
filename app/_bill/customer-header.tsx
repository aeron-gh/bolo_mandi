"use client";
// Top of the screen: customer name big, then what they owe today.
import type { Account, Customer } from "@/lib/customers.ts";
import { formatRupees as r } from "@/lib/money.ts";

type Props = {
  customer: Customer | null;
  account: Account | null;
  note: string | null;
  locked: boolean;
  onChange: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function CustomerHeader({ customer, account, note, locked, onChange }: Props) {
  if (!customer) {
    return (
      <button
        onClick={onChange}
        disabled={locked}
        className="flex h-20 w-full items-center rounded-xl border-2 border-dashed border-line px-4 text-left text-2xl font-semibold outline-coconut focus-visible:outline-3 disabled:opacity-40"
      >
        Customer chuno
      </button>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-4xl font-semibold leading-tight">{customer.name}</h1>
        {!locked && (
          <button onClick={onChange} className="h-11 shrink-0 rounded-lg px-3 font-medium text-coconut outline-coconut hover:bg-paper focus-visible:outline-2">
            Badlo
          </button>
        )}
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Udhaar" value={account ? r(account.outstanding) : "…"} />
        <Stat label="Limit" value={account ? r(account.creditLimit) : "…"} />
        <Stat label="Baaki" value={account ? r(Math.max(0, account.creditLimit - account.outstanding)) : "…"} />
      </dl>
    </div>
  );
}
