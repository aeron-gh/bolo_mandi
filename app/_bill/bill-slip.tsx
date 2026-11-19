"use client";
// The bill as a paper parchi. It changes live; the buttons follow the bill's state.
import type { ReactNode } from "react";
import type { BillPreview } from "@/lib/api.ts";
import { whatIsMissing, type BillDraft, type BillState } from "@/lib/draft.ts";
import { formatRupees as r } from "@/lib/money.ts";

type Props = {
  draft: BillDraft;
  preview: BillPreview | null;
  fresh: boolean;
  error: string | null;
  saving: boolean;
  onReadBack: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onNewBill: () => void;
};

const STATE: Record<BillState, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-ground text-brand" },
  AWAITING_CONFIRM: { label: "Haan ka intezaar", tone: "bg-brand text-white" },
  SAVED: { label: "Bill kat gaya", tone: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancel hua", tone: "bg-red-100 text-red-800" },
};

const primary =
  "h-14 w-full rounded-xl px-4 text-lg font-semibold text-white outline-offset-2 focus-visible:outline-2 disabled:opacity-40";

export function BillSlip(props: Props) {
  const { draft, preview, fresh } = props;
  const state = STATE[draft.state];
  return (
    <div className="mx-auto w-full max-w-md lg:sticky lg:top-6">
      <div className="torn-edge bg-paper px-5 pb-10 pt-5">
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div>
            <p className="text-sm text-muted">Bill{draft.billId ? ` no. ${draft.billId}` : ""}</p>
            <p className="text-2xl font-semibold">{draft.customer?.name ?? "—"}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${state.tone}`}>{state.label}</span>
        </div>
        {draft.customer && preview ? (
          <SlipBody preview={preview} dim={!fresh} asking={draft.state === "DRAFT" || draft.state === "AWAITING_CONFIRM"} />
        ) : (
          <p className="py-10 text-muted">Customer chuno aur maal jodo. Bill yahan apne aap banta jayega.</p>
        )}
      </div>
      <div className="mt-4 space-y-3">
        <Actions {...props} />
        {props.error && <p role="alert" className="font-medium text-red-700">{props.error}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: ReactNode; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-b border-rule py-2 ${strong ? "text-lg font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// "asking" is false once the bill is saved or cancelled, so the question is not shown again.
function SlipBody({ preview: p, dim, asking }: { preview: BillPreview; dim: boolean; asking: boolean }) {
  return (
    <div className={dim ? "opacity-50" : ""} aria-busy={dim}>
      {p.lines.map((line, i) => (
        <Row
          key={i}
          label={<>Grade {line.grade} <span className="text-muted">{line.qty} × {r(line.rate)}</span></>}
          value={r(line.amount)}
        />
      ))}
      <div className="flex items-baseline justify-between py-3">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-4xl font-bold tabular-nums text-brand">{r(p.total)}</span>
      </div>
      <Row label="Cash" value={r(p.cash)} />
      <Row label="UPI" value={r(p.upi)} />
      <Row label="Udhaar" value={r(p.udhaar)} strong />
      <div className="mt-4">
        <Row label="Purana udhaar" value={r(p.customer.outstanding)} />
        <Row label="Naya udhaar" value={r(p.newOutstanding)} strong />
        <Row label={<>Limit baaki <span className="text-muted">/ {r(p.customer.creditLimit)}</span></>} value={r(p.creditLeft)} />
      </div>
      <Warning preview={p} />
      {asking && p.say && (
        <figure className="mt-4 rounded-lg bg-ground p-3">
          <figcaption className="text-sm font-medium text-brand">Bolo kahega</figcaption>
          <blockquote className="mt-1 leading-relaxed">&ldquo;{p.say}&rdquo;</blockquote>
        </figure>
      )}
    </div>
  );
}

function Warning({ preview: p }: { preview: BillPreview }) {
  if (p.overpaidBy > 0) return <p className="mt-4 rounded-lg bg-amber-100 p-3 font-medium text-amber-900">{r(p.overpaidBy)} zyada mila hai.</p>;
  if (p.credit === "over") return <p className="mt-4 rounded-lg bg-red-100 p-3 font-semibold text-red-800">Limit se {r(p.overBy)} upar</p>;
  if (p.credit === "near") return <p className="mt-4 rounded-lg bg-amber-100 p-3 font-medium text-amber-900">Limit ke paas hai</p>;
  return null;
}

// Buttons change with the bill's state; nothing saves without the trader's yes.
function Actions({ draft, preview, fresh, saving, onReadBack, onConfirm, onCancel, onNewBill }: Props) {
  const newBill = <button onClick={onNewBill} className={`${primary} bg-brand outline-brand hover:bg-brand-deep`}>Naya bill</button>;
  const cancel = (
    <button onClick={onCancel} className="h-12 w-full rounded-xl font-medium text-muted outline-brand hover:bg-paper hover:text-ink focus-visible:outline-2">
      Cancel karo
    </button>
  );

  if (draft.state === "SAVED") {
    return <><p className="font-semibold text-green-800">Bill no. {draft.billId} kat gaya. Khate mein likh diya.</p>{newBill}</>;
  }
  if (draft.state === "CANCELLED") {
    return <><p className="font-medium">Bill cancel hua. Kuch save nahi hua.</p>{newBill}</>;
  }

  const missing = whatIsMissing(draft);
  if (draft.state === "AWAITING_CONFIRM") {
    const over = preview?.credit === "over";
    return (
      <>
        <button
          onClick={onConfirm}
          disabled={saving || !fresh}
          className={`${primary} ${over ? "bg-red-700 outline-red-700 hover:bg-red-800" : "bg-brand outline-brand hover:bg-brand-deep"}`}
        >
          {saving ? "Kaat rahe hain…" : over ? "Limit ke bahar, phir bhi kaat do" : "Haan, kaat do"}
        </button>
        <p className="text-sm text-muted">Kuch badalna hai? Upar seedha badlo, Bolo dobara padhega.</p>
        {cancel}
      </>
    );
  }

  const overpaid = (preview?.overpaidBy ?? 0) > 0;
  const hint =
    missing === "customer" ? "Pehle customer chuno." :
    missing === "items" ? "Ab maal jodo." :
    overpaid ? "Cash ya UPI theek karo: wapas dena hai ya advance?" :
    !fresh ? "Hisaab ho raha hai…" : null;
  return (
    <>
      <button onClick={onReadBack} disabled={Boolean(hint)} className={`${primary} bg-brand outline-brand hover:bg-brand-deep`}>
        Bill banao
      </button>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {(draft.customer || draft.items.length > 0) && cancel}
    </>
  );
}
