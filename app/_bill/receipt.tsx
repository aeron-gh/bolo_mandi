"use client";
// The bill as a printed receipt. Rows come from the draft at once; amounts from the server.
import type { ReactNode } from "react";
import type { BillPreview } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { BillDraft } from "@/lib/draft.ts";
import { formatRupees as r } from "@/lib/money.ts";

import { Icon } from "./icons.tsx";

type Props = { draft: BillDraft; preview: BillPreview | null; fresh: boolean; rates: RateCard; blocked: boolean; onCancel: () => void };

function Row({ label, value, strong }: { label: ReactNode; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1.5 ${strong ? "text-lg font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Warning({ p }: { p: BillPreview }) {
  const strip = "mt-3 rounded-lg px-3 py-2 font-semibold";
  if (p.overpaidBy > 0) return <p className={`${strip} bg-amber text-ink`}>{r(p.overpaidBy)} zyada mila. Wapas dena hai ya advance?</p>;
  if (p.credit === "over") return <p className={`${strip} bg-red text-white`}>Limit se {r(p.overBy)} upar</p>;
  if (p.credit === "near") return <p className={`${strip} bg-amber text-ink`}>Limit ke paas hai</p>;
  return null;
}

export function Receipt({ draft, preview, fresh, rates, blocked, onCancel }: Props) {
  const p = fresh ? preview : null;
  const open = draft.state === "DRAFT" || draft.state === "AWAITING_CONFIRM";
  if (draft.items.length === 0 && open) {
    return <div className="receipt-empty">
      <div className="empty-lines"><span className="receipt-glyph"><Icon name="receipt" /></span>
        <h3>Abhi koi maal nahi</h3><p>Grade aur quantity bolo ya Likho mein jodo.</p>
      </div>
      <div className="empty-total"><span>Total</span><strong>{r(0)}</strong></div>
    </div>;
  }
  return (
    <section aria-label="Bill" className="relative">
      <div className={`pt-4 ${draft.state === "CANCELLED" ? "opacity-50" : ""}`}>
        <div className="mb-1 grid grid-cols-[1fr_auto_minmax(3rem,auto)] gap-3 border-b border-line pb-2 text-sm font-semibold text-muted">
          <span>Maal</span><span>Qty × Rate</span><span className="text-right">Rakam</span>
        </div>
        <ul className="divide-y divide-line">
          {draft.items.map((item, i) => {
            const rate = item.rate ?? rates[item.grade];
            return (
              <li key={i} className="row-in grid grid-cols-[1fr_auto_minmax(3rem,auto)] items-baseline gap-3 py-2">
                <span className="font-semibold">Grade {item.grade}</span>
                <span className="text-muted">
                  {item.qty || "?"}{item.unit === "crate" ? " crate" : ""} × <span className={item.rate !== undefined ? "font-semibold text-ink" : ""}>{r(rate)}</span>
                </span>
                <span className="text-right">{p?.lines[i] ? r(p.lines[i].amount) : "…"}</span>
              </li>
            );
          })}
        </ul>
        <div className={`mt-2 rounded-xl bg-canvas px-3 py-2 ${p ? "" : "opacity-50"}`}>
          <div className="mb-1 flex items-baseline justify-between border-b border-line pb-2">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-3xl font-bold">{p ? r(p.total) : "…"}</span>
          </div>
          <Row label="Cash" value={r(draft.cash)} />
          <Row label="UPI" value={r(draft.upi)} />
          <Row label="Udhaar" value={p ? r(p.udhaar) : "…"} strong />
          {p && <Row label="Naya udhaar" value={r(p.newOutstanding)} />}
          {p && <Row label="Limit baaki" value={r(p.creditLeft)} />}
        </div>
        {p && open && <Warning p={p} />}
        {draft.state === "CANCELLED" && <p className="mt-3 font-semibold">Bill cancel hua. Kuch save nahi hua.</p>}
        {open && (
          <button onClick={onCancel} disabled={blocked} className="mt-4 h-11 rounded-lg px-2 font-medium text-muted outline-coconut hover:text-ink focus-visible:outline-2 disabled:opacity-40">
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
