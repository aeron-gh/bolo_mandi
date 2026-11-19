"use client";
// The counter screen: customer on top, receipt in the middle, mic in the thumb zone.
import { useEffect, useReducer, useState } from "react";
import { Toaster, toast } from "sonner";
import { Drawer } from "vaul";
import type { BillPreview } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { Customer } from "@/lib/customers.ts";
import { billReducer, newDraft, newDraftId, whatIsMissing, type BillDraft } from "@/lib/draft.ts";
import { formatRupees } from "@/lib/money.ts";
import { confirmBill, fetchPreview, friendlyError, type BillBody } from "./api-client.ts";
import { CustomerHeader } from "./customer-header.tsx";
import { CustomerSheet } from "./customer-sheet.tsx";
import { Dock, type MainAction } from "./dock.tsx";
import { EntryPanel } from "./entry-panel.tsx";
import { Receipt } from "./receipt.tsx";

// A new key remounts the workspace, which starts a fresh draft.
export function BillScreen({ rates }: { rates: RateCard }) {
  const [round, setRound] = useState(0);
  return (
    <>
      <Workspace key={round} rates={rates} onNewBill={() => setRound((n) => n + 1)} />
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "inherit", fontSize: "1rem" } }} />
    </>
  );
}

type Fresh = { preview: BillPreview | null; fresh: boolean };

// The one big button changes with the bill's state. Nothing saves without "haan".
function mainAction(draft: BillDraft, { preview, fresh }: Fresh, saving: boolean, run: Record<"readBack" | "confirm" | "newBill", () => void>) {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") {
    return { action: { label: "Naya bill", tone: "go", disabled: false, run: run.newBill } as MainAction, hint: null };
  }
  if (draft.state === "AWAITING_CONFIRM") {
    const over = preview?.credit === "over";
    const label = saving ? "Kaat rahe hain" : over ? "Limit ke bahar, phir bhi kaat do" : "Haan, kaat do";
    return { action: { label, tone: over ? "danger" : "go", disabled: saving || !fresh, run: run.confirm } as MainAction, hint: "Kuch badalna hai? Likho mein badlo, Bolo dobara padhega." };
  }
  const missing = whatIsMissing(draft);
  const hint =
    missing === "customer" ? "Pehle customer chuno." :
    missing === "items" ? "Ab maal jodo: mic dabao ya Likho kholo." :
    (preview?.overpaidBy ?? 0) > 0 ? "Cash ya UPI theek karo." :
    !fresh ? "Hisaab ho raha hai" : null;
  return { action: { label: "Bill banao", tone: "go", disabled: Boolean(hint), run: run.readBack } as MainAction, hint };
}

function Workspace({ rates, onNewBill }: { rates: RateCard; onNewBill: () => void }) {
  const [draft, dispatch] = useReducer(billReducer, null, newDraft);
  const [preview, setPreview] = useState<{ key: string; data: BillPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [words, setWords] = useState("");
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [likhoOpen, setLikhoOpen] = useState(false);

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

  function pick(customer: Customer, fuzzyFrom?: string) {
    dispatch({ type: "setCustomer", customer });
    setPickNote(fuzzyFrom ? `"${fuzzyFrom}" se milta-julta naam chuna. Galat ho to Badlo.` : null);
  }

  async function confirm() {
    if (!body || !fresh || !preview || !draft.draftId) return;
    setSaving(true);
    try {
      const result = await confirmBill({ ...body, draftId: draft.draftId, allowOverLimit: preview.data.credit === "over" });
      if (result.status !== "saved") return setError("Bill save nahi hua. Upar dekh ke phir se try karo.");
      dispatch({ type: "saved", billId: result.billId });
      // Toast after the stamp has landed (at once when motion is reduced).
      const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
      const name = draft.customer?.name ?? "";
      setTimeout(() => toast.success(`Bill no. ${result.billId} kat gaya`, { description: `${name} ka udhaar ab ${formatRupees(result.newOutstanding)}` }), wait);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const locked = draft.state === "SAVED" || draft.state === "CANCELLED";
  const { action, hint } = mainAction(draft, { preview: preview?.data ?? null, fresh }, saving, {
    readBack: () => dispatch({ type: "readBack", draftId: newDraftId() }),
    confirm: () => void confirm(),
    newBill: onNewBill,
  });
  const question = draft.state === "AWAITING_CONFIRM" && fresh ? (preview?.data.say ?? null) : null;
  const panel = <EntryPanel items={draft.items} cash={draft.cash} upi={draft.upi} rates={rates} locked={locked} dispatch={dispatch} />;

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col">
        <div className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-5">
          <CustomerHeader
            customer={draft.customer}
            account={preview?.data.customer ?? null}
            note={pickNote}
            locked={locked}
            onChange={() => setCustomerOpen(true)}
          />
          <Receipt draft={draft} preview={preview?.data ?? null} fresh={fresh} rates={rates} onCancel={() => dispatch({ type: "cancel" })} />
        </div>
        <Dock
          words={words}
          question={question}
          problem={error}
          action={action}
          hint={hint}
          onWords={setWords}
          onProblem={setError}
          onLikho={() => setLikhoOpen(true)}
        />
      </div>

      <aside className="hidden border-l border-line bg-paper lg:block" aria-label="Likho">
        <div className="sticky top-0 p-6">{panel}</div>
      </aside>

      <CustomerSheet open={customerOpen} onOpenChange={setCustomerOpen} onPick={pick} />

      <Drawer.Root open={likhoOpen} onOpenChange={setLikhoOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-2xl bg-canvas outline-none">
            <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" />
            <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-center justify-between">
                <Drawer.Title className="text-xl font-semibold">Likho</Drawer.Title>
                <button onClick={() => setLikhoOpen(false)} className="h-11 rounded-lg px-3 font-semibold text-coconut outline-coconut focus-visible:outline-2">
                  Ho gaya
                </button>
              </div>
              <Drawer.Description className="sr-only">Maal aur payment haath se likho</Drawer.Description>
              <div className="mt-3">{panel}</div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </main>
  );
}
