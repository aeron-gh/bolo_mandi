"use client";
// The bill as a printed receipt. Rows come from the draft at once; amounts from the server.
import NumberFlow from "@number-flow/react";
import type { ReactNode } from "react";
import type { BillPreview } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { BillDraft } from "@/lib/draft.ts";
import { formatRupees as r } from "@/lib/money.ts";

type Props = { draft: BillDraft; preview: BillPreview | null; fresh: boolean; rates: RateCard; blocked: boolean; onCancel: () => void };

// Animation 3: the total rolls to its new value. NumberFlow skips it for reduced motion.
const RUPEES = { style: "currency", currency: "INR", minimumFractionDigits: 2, trailingZeroDisplay: "stripIfInteger" } as const;

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
    return <p className="rounded-xl border border-line bg-paper px-4 py-8 text-center text-muted">Abhi koi maal nahi. Mic dabao ya Likho kholo.</p>;
  }
  return (
    <section aria-label="Bill" className="relative">
      <div className={`torn-edge border-x border-t border-line bg-paper px-4 pb-8 pt-3 ${draft.state === "CANCELLED" ? "opacity-50" : ""}`}>
        <ul className="divide-y divide-line">
          {draft.items.map((item, i) => {
            const rate = item.rate ?? rates[item.grade];
            return (
              <li key={i} className="row-in grid grid-cols-[1fr_auto_6rem] items-baseline gap-3 py-2">
                <span className="font-semibold">Grade {item.grade}</span>
                <span className="text-muted">
                  {item.qty || "?"}{item.unit === "crate" ? " crate" : ""} × <span className={item.rate !== undefined ? "font-semibold text-ink" : ""}>{r(rate)}</span>
                </span>
                <span className="text-right">{p?.lines[i] ? r(p.lines[i].amount) : "…"}</span>
              </li>
            );
          })}
        </ul>
        <div className={`mt-2 border-t-2 border-ink pt-2 ${p ? "" : "opacity-50"}`}>
          <Row label="Cash" value={r(draft.cash)} />
          <Row label="UPI" value={r(draft.upi)} />
          <Row label="Udhaar" value={p ? r(p.udhaar) : "…"} strong />
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
            <span className="text-xl font-semibold">Total</span>
            <NumberFlow value={(preview?.total ?? 0) / 100} locales="en-IN" format={RUPEES} className="text-4xl font-bold" />
          </div>
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
