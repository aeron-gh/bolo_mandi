"use client";
// The counter screen: customer on top, receipt in the middle, mic in the thumb zone.
import { useEffect, useReducer, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { Drawer } from "vaul";
import type { BillPreview } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import { billReducer, newDraft, newDraftId, whatIsMissing, type Action, type BillDraft } from "@/lib/draft.ts";
import { formatRupees } from "@/lib/money.ts";
import { hindiReadBack } from "@/lib/readback.ts";
import { confirmBill, fetchPreview, friendlyError, interpretBill, type BillBody } from "./api-client.ts";
import { CustomerHeader } from "./customer-header.tsx";
import { CustomerSheet } from "./customer-sheet.tsx";
import { Dock, type MainAction } from "./dock.tsx";
import { EntryPanel } from "./entry-panel.tsx";
import { Receipt } from "./receipt.tsx";
import { speakHindi, stopSpeaking } from "./speech.ts";

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
type CustomerSuggestion = { name: string; match: CustomerMatch };

function speakPreview(preview: BillPreview) {
  speakHindi(hindiReadBack({ ...preview, customerName: preview.customer.name }));
}

// The one big button changes with the bill's state. Nothing saves without "haan".
function mainAction(draft: BillDraft, { preview, fresh }: Fresh, saving: boolean): { action: Omit<MainAction, "run">; hint: string | null } {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") {
    return { action: { label: "Naya bill", tone: "go", disabled: false }, hint: null };
  }
  if (draft.state === "AWAITING_CONFIRM") {
    const over = preview?.credit === "over";
    const label = saving ? "Kaat rahe hain" : over ? "Limit ke bahar, phir bhi kaat do" : "Haan, kaat do";
    return { action: { label, tone: over ? "danger" : "go", disabled: saving || !fresh }, hint: "Kuch badalna hai? Bolo ya Likho mein badlo." };
  }
  const missing = whatIsMissing(draft);
  const hint =
    missing === "customer" ? "Pehle customer chuno." :
    missing === "items" ? "Ab maal jodo: mic dabao ya Likho kholo." :
    (preview?.overpaidBy ?? 0) > 0 ? "Cash ya UPI theek karo." :
    !fresh ? "Hisaab ho raha hai" : null;
  return { action: { label: "Bill banao", tone: "go", disabled: Boolean(hint) }, hint };
}

function Workspace({ rates, onNewBill }: { rates: RateCard; onNewBill: () => void }) {
  const [draft, dispatch] = useReducer(billReducer, null, newDraft);
  const [preview, setPreview] = useState<{ key: string; data: BillPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<{ key: string; message: string } | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [words, setWords] = useState("");
  const [voice, setVoice] = useState<"idle" | "recording" | "interpreting">("idle");
  const voiceRequest = useRef<AbortController | null>(null);
  const reviewRequested = useRef(false);
  const [suggestion, setSuggestion] = useState<CustomerSuggestion | null>(null);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [likhoOpen, setLikhoOpen] = useState(false);

  const body: BillBody | null = draft.customer
    ? { customerId: draft.customer.id, items: draft.items, cash: draft.cash, upi: draft.upi }
    : null;
  const key = JSON.stringify({ body, version: previewVersion });
  // Only a preview made for exactly this bill may be read back or confirmed.
  const fresh = preview?.key === key;

  useEffect(() => {
    const { body: request } = JSON.parse(key) as { body: BillBody | null };
    if (!request) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPreview(request, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setPreview({ key, data });
            setPreviewError(null);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setPreviewError({ key, message: friendlyError(e) });
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  useEffect(() => () => {
    voiceRequest.current?.abort();
    stopSpeaking();
  }, []);

  useEffect(() => {
    if (!reviewRequested.current || voice !== "idle" || customerOpen || likhoOpen || saving ||
        draft.state !== "DRAFT" || whatIsMissing(draft) || !fresh || !preview) return;
    reviewRequested.current = false;
    speakPreview(preview.data);
    if (!preview.data.overpaidBy) dispatch({ type: "readBack", draftId: newDraftId() });
  }, [customerOpen, draft, fresh, likhoOpen, preview, saving, voice]);

  function edit(action: Action) {
    reviewRequested.current = false;
    stopSpeaking();
    setError(null);
    dispatch(action);
  }

  function pick(customer: Customer, fuzzyFrom?: string) {
    if (suggestion) {
      setSuggestion(null);
      setError(null);
      reviewRequested.current = true;
      dispatch({ type: "setCustomer", customer });
    } else {
      edit({ type: "setCustomer", customer });
    }
    setPickNote(fuzzyFrom ? `"${fuzzyFrom}" se milta-julta naam chuna. Galat ho to Badlo.` : null);
  }

  function review() {
    if (!fresh || !preview || whatIsMissing(draft)) return;
    setError(null);
    speakPreview(preview.data);
    if (!preview.data.overpaidBy) dispatch({ type: "readBack", draftId: newDraftId() });
  }

  async function confirm() {
    if (draft.state !== "AWAITING_CONFIRM" || !body || !fresh || !preview || !draft.draftId || saveInFlight.current) return;
    saveInFlight.current = true;
    stopSpeaking();
    setError(null);
    setSaving(true);
    try {
      const result = await confirmBill({ ...body, draftId: draft.draftId, allowOverLimit: preview.data.credit === "over" });
      if (result.status !== "saved") {
        dispatch({ type: "reviewAgain" });
        setPreviewVersion((version) => version + 1);
        reviewRequested.current = true;
        return setError("Hisaab badal gaya. Naya hisaab dekh ke phir se haan bolo.");
      }
      dispatch({ type: "saved", billId: result.billId });
      speakHindi(`बिल नंबर ${result.billId} कट गया।`);
      // Toast after the stamp has landed (at once when motion is reduced).
      const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
      const name = draft.customer?.name ?? "";
      setTimeout(() => toast.success(`Bill no. ${result.billId} kat gaya`, { description: `${name} ka udhaar ab ${formatRupees(result.newOutstanding)}` }), wait);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  function startVoice() {
    stopSpeaking();
    reviewRequested.current = false;
    setVoice("recording");
    setWords("");
    setError(null);
  }

  async function finishVoice(text: string, problem?: string) {
    setWords(text);
    if (!text) {
      setVoice("idle");
      if (problem) setError(problem);
      return;
    }
    setVoice("interpreting");
    const controller = new AbortController();
    voiceRequest.current = controller;
    try {
      const turn = await interpretBill(text, { items: draft.items, cash: draft.cash, upi: draft.upi }, !draft.customer, controller.signal);
      if (controller.signal.aborted) return;
      if (turn.kind === "confirm") {
        if (draft.state === "AWAITING_CONFIRM" && fresh) void confirm();
        else setError("Pehle bill ka hisaab suno, phir haan bolo.");
      } else if (turn.kind === "review") {
        review();
      } else if (turn.kind === "cancel") {
        setSuggestion(null);
        edit({ type: "cancel" });
        speakHindi("बिल रद्द हो गया।");
      } else if (turn.kind === "repeat") {
        dispatch({ type: "reviewAgain" });
        const prompt = {
          payment: ["Kitne rupaye cash ya UPI mile?", "कितने रुपये कैश या यूपीआई मिले?"],
          line: ["Kaunsi line badalni hai? Grade bolo ya Likho mein badlo.", "कौन सी लाइन बदलनी है? ग्रेड बोलें या लिखकर बदलें।"],
          unclear: ["Baat samajh nahi aayi. Jaise bolo, Manat ko 10 piece grade 1.", "बात समझ नहीं आई। फिर से बोलें।"],
        }[turn.reason];
        setError(prompt[0]);
        speakHindi(prompt[1]);
      } else if (turn.kind === "edit") {
        const match = turn.match;
        const name = turn.name;
        const customer = match ? (match.kind === "found" ? match.customer : null) : draft.customer;
        if (match && name) {
          setSuggestion(match.kind === "found" ? null : { name, match });
          setPickNote(match.kind === "found" && match.fuzzy ? `"${name}" se milta-julta naam chuna. Galat ho to Badlo.` : null);
          if (match.kind === "ambiguous") speakHindi("कौन सा ग्राहक? पूरा नाम बोलें या सूची से चुनें।");
          if (match.kind === "not_found") speakHindi("नाम सूची में नहीं मिला। ग्राहक चुनें।");
        }
        reviewRequested.current = true;
        dispatch({ type: "voiceEdit", customer, ...turn.entries });
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        dispatch({ type: "reviewAgain" });
        setError(friendlyError(e));
      }
    } finally {
      if (!controller.signal.aborted) {
        voiceRequest.current = null;
        setVoice("idle");
      }
    }
  }

  const locked = draft.state === "SAVED" || draft.state === "CANCELLED";
  const busy = saving || voice !== "idle";
  const { action, hint } = mainAction(draft, { preview: preview?.data ?? null, fresh }, saving);
  const run = locked ? onNewBill : draft.state === "AWAITING_CONFIRM" ? () => void confirm() : review;
  const question = draft.state === "AWAITING_CONFIRM" && fresh ? (preview?.data.say ?? null) : null;
  const customerQuestion = suggestion?.match.kind === "ambiguous"
    ? `Kaun sa ${suggestion.name}? Poora naam bolo ya customer chuno.`
    : suggestion && `"${suggestion.name}" ka naam nahi mila. Phir se bolo ya customer chuno.`;
  const panel = <EntryPanel items={draft.items} cash={draft.cash} upi={draft.upi} rates={rates} locked={locked || busy} dispatch={edit} />;

  return (
    <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex min-w-0 flex-col">
        <div className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-5">
          <CustomerHeader
            customer={draft.customer}
            account={preview?.data.customer.id === draft.customer?.id ? preview?.data.customer ?? null : null}
            note={pickNote}
            locked={locked || busy}
            onChange={() => setCustomerOpen(true)}
          />
          <Receipt draft={draft} preview={preview?.data ?? null} fresh={fresh} rates={rates} blocked={busy}
            onCancel={() => { setSuggestion(null); edit({ type: "cancel" }); }} />
        </div>
        <Dock
          words={words}
          question={question ?? customerQuestion}
          problem={error ?? (previewError?.key === key ? previewError.message : null)}
          action={{ ...action, run }}
          hint={customerQuestion ? null : hint}
          busy={busy}
          micDisabled={locked || saving || voice === "interpreting" || customerOpen || likhoOpen}
          onReplay={question ? review : null}
          onStart={startVoice}
          onWords={setWords}
          onFinish={(text, problem) => void finishVoice(text, problem)}
          onLikho={() => setLikhoOpen(true)}
        />
      </div>

      <aside className="hidden border-l border-line bg-paper lg:block" aria-label="Likho">
        <div className="sticky top-0 p-6">{panel}</div>
      </aside>

      <CustomerSheet key={suggestion ? `voice:${suggestion.name}` : "manual"} open={customerOpen} suggestion={suggestion} onOpenChange={setCustomerOpen} onPick={pick} />

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
