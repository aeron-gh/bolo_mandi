"use client";
// The bill slip. While kaccha every part is editable; pakka and radd bills are read-only.
// Rows come from the draft at once; amounts come from the server preview.
import type { ReactNode } from "react";
import type { BillPreview } from "@/lib/api.ts";
import type { ItemInput, RateCard } from "@/lib/billing.ts";
import type { Action, BillDraft } from "@/lib/draft.ts";
import { formatRupees as r } from "@/lib/money.ts";
import { AddLine, LimitBar, LineEditor, PaymentEditor } from "./bill-editor.tsx";

type Props = {
  draft: BillDraft; preview: BillPreview | null; fresh: boolean; rates: RateCard; blocked: boolean;
  lit: number[]; onEdit: (action: Action) => void; onCancel: () => void;
};

function Row({ label, value, strong }: { label: ReactNode; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? "text-lg font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Read-only lines for a pakka or radd bill.
function FixedLines({ items, rates, preview }: { items: ItemInput[]; rates: RateCard; preview: BillPreview | null }) {
  return (
    <>
      <div className="mb-1 grid grid-cols-[1fr_auto_minmax(3rem,auto)] gap-3 border-b border-line pb-2 text-sm font-semibold text-muted">
        <span>Maal</span><span>Qty × Rate</span><span className="text-right">Rakam</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((item, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto_minmax(3rem,auto)] items-baseline gap-3 py-2">
            <span className="font-semibold">Grade {item.grade}</span>
            <span className="text-muted">{item.qty}{item.unit === "crate" ? " crate" : ""} × {r(item.rate ?? rates[item.grade])}</span>
            <span className="text-right">{preview?.lines[i] ? r(preview.lines[i].amount) : "…"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Receipt({ draft, preview, fresh, rates, blocked, lit, onEdit, onCancel }: Props) {
  const p = fresh ? preview : null;
  const open = draft.state === "DRAFT" || draft.state === "AWAITING_CONFIRM";
  const locked = !open || blocked;
  const addLine = (item: ItemInput) => onEdit({ type: "addItem", item });

  return (
    <section aria-label="Bill" className="relative">
      <div className={`slip-section ${draft.state === "CANCELLED" ? "opacity-50" : ""}`}>
        {open ? (
          <>
            {draft.items.length === 0 && <p className="slip-empty">Abhi koi maal nahi. Boliye, ya yahin jodiye.</p>}
            <ul className="edit-lines">
              {draft.items.map((item, i) => (
                <LineEditor key={i} index={i} item={item} listRate={rates[item.grade]} locked={locked} lit={lit.includes(i)}
                  amount={p?.lines[i] ? p.lines[i].amount : null}
                  update={(changes) => onEdit({ type: "updateItem", index: i, changes })}
                  remove={() => onEdit({ type: "removeItem", index: i })} />
              ))}
            </ul>
            <AddLine locked={locked} add={addLine} />
          </>
        ) : (
          <FixedLines items={draft.items} rates={rates} preview={p} />
        )}

        {open && draft.items.length > 0 && (
          <PaymentEditor cash={draft.cash} upi={draft.upi} total={p ? p.total : null} locked={locked}
            setPayment={(payment) => onEdit({ type: "setPayment", ...payment })} />
        )}

        {draft.items.length > 0 && (
          <div className={`slip-totals ${p ? "" : "opacity-50"}`}>
            <div className="slip-total">
              <span>Total</span>
              <strong>{p ? r(p.total) : "…"}</strong>
            </div>
            {!open && <Row label="Cash" value={r(draft.cash)} />}
            {!open && <Row label="UPI" value={r(draft.upi)} />}
            <Row label="Udhaar" value={p ? r(p.udhaar) : "…"} strong />
            {p && <Row label="Naya udhaar" value={r(p.newOutstanding)} />}
          </div>
        )}
        {p && open && draft.items.length > 0 && (
          <LimitBar newOutstanding={p.newOutstanding} limit={p.customer.creditLimit} credit={p.credit} overBy={p.overBy} />
        )}
        {p && open && p.overpaidBy > 0 && (
          <p className="mt-3 rounded-lg bg-amber px-3 py-2 font-semibold text-ink">{r(p.overpaidBy)} zyada mila. Wapas dena hai ya advance?</p>
        )}
        {draft.state === "CANCELLED" && <p className="mt-3 font-semibold">Bill radd hua. Kuch save nahi hua.</p>}
        {open && (draft.items.length > 0 || draft.customer) && (
          <button onClick={onCancel} disabled={blocked} className="mt-2 h-11 rounded-lg font-medium text-muted outline-coconut hover:text-ink focus-visible:outline-2 disabled:opacity-40">
            Bill cancel karo
          </button>
        )}
      </div>
      {draft.state === "SAVED" && (
        <p
          lang="hi"
          className="stamp pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 rounded-lg border-4 border-double border-coconut px-5 py-1 text-5xl font-bold text-coconut opacity-90 mix-blend-multiply"
        >
          बिल कटा
        </p>
      )}
    </section>
  );
}
