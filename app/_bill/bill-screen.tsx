"use client";
// The bill counter: work area on the left, the live bill slip on the right.
import { useEffect, useReducer, useState } from "react";
import type { RateCard } from "@/lib/billing.ts";
import type { BillPreview } from "@/lib/api.ts";
import { billReducer, newDraft, newDraftId } from "@/lib/draft.ts";
import { confirmBill, fetchPreview, friendlyError, type BillBody } from "./api-client.ts";
import { CustomerPicker } from "./customer-picker.tsx";
import { ItemsEditor } from "./items-editor.tsx";
import { PaymentInputs } from "./payment-inputs.tsx";
import { BillSlip } from "./bill-slip.tsx";

// A new key remounts the workspace, which starts a fresh draft.
export function BillScreen({ rates }: { rates: RateCard }) {
  const [round, setRound] = useState(0);
  return <Workspace key={round} rates={rates} onNewBill={() => setRound((n) => n + 1)} />;
}

function Workspace({ rates, onNewBill }: { rates: RateCard; onNewBill: () => void }) {
  const [draft, dispatch] = useReducer(billReducer, null, newDraft);
  const [preview, setPreview] = useState<{ key: string; data: BillPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const body: BillBody | null = draft.customer
    ? { customerId: draft.customer.id, items: draft.items, cash: draft.cash, upi: draft.upi }
    : null;
  const key = JSON.stringify(body);
  // Only a preview made for exactly this bill may be read back or confirmed.
  const fresh = preview?.key === key;

  useEffect(() => {
    const request = JSON.parse(key) as BillBody | null;
    if (!request) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPreview(request, controller.signal)
        .then((data) => {
          setPreview({ key, data });
          setError(null);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(friendlyError(e));
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  async function confirm() {
    if (!body || !fresh || !preview || !draft.draftId) return;
    setSaving(true);
    try {
      const result = await confirmBill({ ...body, draftId: draft.draftId, allowOverLimit: preview.data.credit === "over" });
      if (result.status === "saved") dispatch({ type: "saved", billId: result.billId });
      else setError("Bill save nahi hua. Upar dekh ke phir se try karo.");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const locked = draft.state === "SAVED" || draft.state === "CANCELLED";
  return (
    // grid-cols-1 is minmax(0,1fr): without it, input boxes push the column wider than a phone.
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="space-y-10 px-4 py-6 sm:px-8">
        <CustomerPicker selected={draft.customer} disabled={locked} onPick={(customer) => dispatch({ type: "setCustomer", customer })} />
        <ItemsEditor items={draft.items} lines={fresh ? preview.data.lines : null} rates={rates} disabled={locked} dispatch={dispatch} />
        <PaymentInputs cash={draft.cash} upi={draft.upi} disabled={locked} dispatch={dispatch} />
      </div>
      <aside className="bg-ground px-4 py-6 sm:px-8" aria-label="Bill">
        <BillSlip
          draft={draft}
          preview={preview?.data ?? null}
          fresh={fresh}
          error={error}
          saving={saving}
          onReadBack={() => dispatch({ type: "readBack", draftId: newDraftId() })}
          onConfirm={confirm}
          onCancel={() => dispatch({ type: "cancel" })}
          onNewBill={onNewBill}
        />
      </aside>
    </main>
  );
}
