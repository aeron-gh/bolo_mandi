"use client";
// Conversation and bill share a draft until the owner confirms the sale.
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { Drawer } from "vaul";
import type { BillPreview, LedgerTask } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import { billReducer, newDraft, newDraftId, startDraft, whatIsMissing, type Action, type BillDraft, type StartNote } from "@/lib/draft.ts";
import { formatRupees } from "@/lib/money.ts";
import { hindiReadBack } from "@/lib/readback.ts";
import { advanceQuestion, DROPPED, paymentDone, promiseDone, type Say } from "@/lib/talk.ts";
import type { FollowUp } from "@/lib/voice.ts";
import { confirmBill, fetchPreview, friendlyError, interpretBill, recordVaada, recordVasooli, type BillBody } from "./api-client.ts";
import { Conversation, type Message } from "./conversation.tsx";
import { CustomerHeader } from "./customer-header.tsx";
import { CustomerSheet } from "./customer-sheet.tsx";
import { Dock } from "./dock.tsx";
import { draftKey, keepDraft, loadDraft } from "./draft-store.ts";
import { EntryPanel } from "./entry-panel.tsx";
import { Icon } from "./icons.tsx";
import { MicButton } from "./mic-button.tsx";
import { Receipt } from "./receipt.tsx";
import { speakHindi, stopSpeaking } from "./speech.ts";

type ScreenProps = { rates: RateCard; shopKey: string; startCustomer: Customer | null; greeting: string; example: string | null };

// A new key remounts the workspace, which starts a fresh draft. Only the first round
// looks for a bill left open on this device or a customer from the link.
export function BillScreen({ rates, shopKey, startCustomer, greeting, example }: ScreenProps) {
  const [round, setRound] = useState(0);
  return (
    <>
      <Workspace key={round} rates={rates} storageKey={draftKey(shopKey)} firstRound={round === 0}
        startCustomer={startCustomer} greeting={greeting} example={example} onNewBill={() => setRound((n) => n + 1)} />
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "inherit", fontSize: "1rem" } }} />
    </>
  );
}

type MainAction = { label: string; tone: "go" | "danger"; disabled: boolean };

// In a mandi the rough slip is "kaccha" and the final bill "pakka".
const SLIP_TITLE: Record<BillDraft["state"], string> = {
  DRAFT: "Kaccha bill", AWAITING_CONFIRM: "Kaccha bill", SAVED: "Pakka bill", CANCELLED: "Radd bill",
};
type Fresh = { preview: BillPreview | null; fresh: boolean };
type CustomerSuggestion = { name: string; match: CustomerMatch };

function speakPreview(preview: BillPreview) {
  const lines = preview.lines.map((line) => `ग्रेड ${line.grade} के ${line.qty} ${line.unit === "crate" ? "क्रेट" : "पीस"}।`);
  speakHindi([...lines, hindiReadBack({ ...preview, customerName: preview.customer.name })].join(" "));
}

function nextVoiceQuestion(followUp: FollowUp | null, missing: ReturnType<typeof whatIsMissing>) {
  if (followUp?.kind === "grade") {
    return [`${followUp.qty} ${followUp.unit} likh liye. Kaunsa grade, 1, 2 ya 3?`, `${followUp.qty} ${followUp.unit === "crate" ? "क्रेट" : "पीस"} लिख लिए। कौन सा ग्रेड, एक, दो या तीन?`];
  }
  if (followUp?.kind === "payment") {
    if (followUp.mode === "cash") return ["Kitna cash mila? Rakam boliye.", "कितना कैश मिला? रकम बोलिए।"];
    if (followUp.mode === "upi") return ["UPI se kitna aaya? Rakam boliye.", "यूपीआई से कितना आया? रकम बोलिए।"];
    return ["Kitne rupaye mile, cash ya UPI mein?", "कितने रुपये मिले, कैश या यूपीआई में?"];
  }
  if (missing === "customer") return ["Kiske naam ka bill banaun?", "किसके नाम का बिल बनाऊँ?"];
  if (missing === "items") return ["Kitna maal dena hai? Piece ya crate, aur grade boliye.", "कितना माल देना है? पीस या क्रेट, और ग्रेड बोलिए।"];
  return null;
}

// The one big button changes with the bill's state. Nothing saves without "haan".
function mainAction(draft: BillDraft, { preview, fresh }: Fresh, saving: boolean): { action: MainAction; hint: string | null } {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") {
    return { action: { label: "Naya bill", tone: "go", disabled: false }, hint: null };
  }
  if (draft.state === "AWAITING_CONFIRM") {
    const over = preview?.credit === "over";
    const label = saving ? "Kaat rahe hain" : over ? "Limit ke bahar, phir bhi kaat do" : "Haan, kaat do";
    return { action: { label, tone: over ? "danger" : "go", disabled: saving || !fresh }, hint: null };
  }
  const missing = whatIsMissing(draft);
  const hint =
    missing === "customer" ? "Pehle customer chuno." :
    missing === "items" ? "Grade aur quantity bolo ya Likho mein jodo." :
    (preview?.overpaidBy ?? 0) > 0 ? "Cash ya UPI theek karo." :
    !fresh ? "Hisaab ho raha hai" : null;
  return { action: { label: "Bill banao", tone: "go", disabled: Boolean(hint) }, hint };
}

type WorkspaceProps = Omit<ScreenProps, "shopKey"> & { storageKey: string; firstRound: boolean; onNewBill: () => void };

// What to tell the owner about how this bill started.
function startMessage(note: StartNote, draft: BillDraft, asked: Customer | null): string | null {
  if (note !== "restored") return null;
  if (asked && asked.id !== draft.customer?.id) return `Pehle ka adhoora bill khula hai. ${asked.name} ka bill iske baad banao.`;
  return "Adhoora bill wapas aaya. Dekh kar aage badhao.";
}

function Workspace({ rates, storageKey, firstRound, startCustomer, greeting, example, onNewBill }: WorkspaceProps) {
  const [start] = useState(() =>
    firstRound ? startDraft(loadDraft(storageKey), startCustomer) : { draft: newDraft(), note: null as StartNote });
  const [draft, dispatch] = useReducer(billReducer, start.draft);
  const [preview, setPreview] = useState<{ key: string; data: BillPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<{ key: string; message: string } | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [mobileView, setMobileView] = useState<"chat" | "bill">("chat");
  const [words, setWords] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [voice, setVoice] = useState<"idle" | "recording" | "interpreting">("idle");
  const voiceRequest = useRef<AbortController | null>(null);
  const reviewRequested = useRef(false);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [voiceQuestion, setVoiceQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{ text: string; speech: string } | null>(null);
  // A vasooli or vaada Bolo has said back and is waiting for "haan" on. One draft id, so it saves once.
  const [task, setTask] = useState<(LedgerTask & { draftId: string }) | null>(null);
  const [accountQuestion, setAccountQuestion] = useState(false);
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
    }, reviewRequested.current ? 0 : 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  useEffect(() => () => {
    voiceRequest.current?.abort();
    stopSpeaking();
  }, []);

  // Keep the open bill on this device so a reload or a closed tab does not lose it.
  useEffect(() => keepDraft(storageKey, draft), [storageKey, draft]);

  // Say once how the bill started, and drop "?customer=" so a reload does not apply it again.
  useEffect(() => {
    const message = startMessage(start.note, start.draft, startCustomer);
    if (message) toast(message, { id: "start-note" });
    if (startCustomer) window.history.replaceState(null, "", "/app");
  }, [start, startCustomer]);

  useEffect(() => {
    if (!reviewRequested.current || voice !== "idle" || customerOpen || likhoOpen || saving ||
        draft.state !== "DRAFT" || followUp || whatIsMissing(draft) || !fresh || !preview) return;
    reviewRequested.current = false;
    speakPreview(preview.data);
    if (!preview.data.overpaidBy) dispatch({ type: "readBack", draftId: newDraftId() });
  }, [customerOpen, draft, followUp, fresh, likhoOpen, preview, saving, voice]);

  function edit(action: Action) {
    reviewRequested.current = false;
    stopSpeaking();
    setError(null);
    const paymentEntered = action.type === "setPayment" && followUp?.kind === "payment"
      && (!followUp.mode || action[followUp.mode] !== undefined);
    if (action.type === "cancel" || (action.type === "addItem" && followUp?.kind === "grade") || paymentEntered) setFollowUp(null);
    setVoiceQuestion(null);
    dispatch(action);
  }

  function pick(customer: Customer, fuzzyFrom?: string) {
    if (suggestion) {
      setSuggestion(null);
      setError(null);
      askNext(whatIsMissing({ ...draft, customer }), followUp);
      reviewRequested.current = !followUp;
      dispatch({ type: "setCustomer", customer });
    } else {
      edit({ type: "setCustomer", customer });
    }
    setPickNote(fuzzyFrom ? `"${fuzzyFrom}" se milta-julta naam chuna. Galat ho to Badlo.` : null);
  }

  function review() {
    if (!fresh || !preview || followUp || whatIsMissing(draft)) return;
    setError(null);
    speakPreview(preview.data);
    if (!preview.data.overpaidBy) dispatch({ type: "readBack", draftId: newDraftId() });
  }

  async function confirm() {
    if (draft.state !== "AWAITING_CONFIRM" || !body || !fresh || !preview || !draft.draftId || followUp || saveInFlight.current) return;
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
        return setError("Hisaab badal gaya. Naya hisaab dekh kar phir se haan boliye.");
      }
      dispatch({ type: "saved", billId: result.billId });
      const who = draft.customer?.name ?? "";
      say({
        text: `Bill ${result.billId} kat gaya. ${who} ka udhaar ab ${formatRupees(result.newOutstanding)} hai. Agla bill boliye.`,
        speech: `बिल कट गया। ${who} का उधार अब ${formatRupees(result.newOutstanding).slice(1)} रुपये है।`,
      });
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

  function say(line: Say) {
    setAnswer(line);
    speakHindi(line.speech);
  }

  // "Haan" to a vasooli or vaada: save it once, then say what changed.
  async function runTask(pending: LedgerTask & { draftId: string }) {
    try {
      if (pending.action === "promise") {
        await recordVaada({ draftId: pending.draftId, customerId: pending.customerId, amount: pending.amount, due: pending.due });
        setTask(null);
        return say(promiseDone());
      }
      const result = await recordVasooli({ draftId: pending.draftId, customerId: pending.customerId, amount: pending.amount, mode: pending.mode, allowAdvance: pending.allowAdvance });
      if (result.status === "needs_answer") {
        setTask({ ...pending, allowAdvance: true });
        return say(advanceQuestion({ name: pending.name, before: pending.amount - result.extra, extra: result.extra }));
      }
      setTask(null);
      say(paymentDone({ name: pending.name, after: result.newOutstanding }));
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function startVoice() {
    stopSpeaking();
    reviewRequested.current = false;
    setVoice("recording");
    setWords("");
    setError(null);
  }

  function askNext(missing: ReturnType<typeof whatIsMissing>, pending: FollowUp | null) {
    const prompt = nextVoiceQuestion(pending, missing);
    setVoiceQuestion(prompt?.[0] ?? null);
    if (prompt) speakHindi(prompt[1]);
  }

  async function finishVoice(text: string, problem?: string) {
    setWords("");
    if (!text) {
      setVoice("idle");
      if (problem) {
        setError(problem);
        if (problem.startsWith("Mujhe saaf sunai")) speakHindi("मुझे साफ़ सुनाई नहीं दिया। एक बार फिर बोलें।");
      }
      return;
    }
    setMessages((history) => [
      ...history,
      ...(history.length && reply ? [{ author: "bolo", text: reply } as const] : []),
      { author: "owner", text },
    ]);
    setAnswer(null);
    setVoice("interpreting");
    const controller = new AbortController();
    voiceRequest.current = controller;
    try {
      const turn = await interpretBill(text, { items: draft.items, cash: draft.cash, upi: draft.upi }, draft.customer?.id ?? null, followUp, accountQuestion, controller.signal);
      if (controller.signal.aborted) return;
      if (turn.kind !== "repeat") setAccountQuestion(turn.kind === "answer" && Boolean(turn.needsName));
      // A new bill line or question means the owner moved on: drop the waiting vasooli or vaada.
      if (task && (turn.kind === "answer" || turn.kind === "edit" || turn.kind === "review")) setTask(null);
      if (turn.kind === "task") {
        setTask(turn.task && { ...turn.task, draftId: newDraftId() });
        say(turn);
      } else if (task && turn.kind === "confirm") {
        await runTask(task);
      } else if (task && (turn.kind === "deny" || turn.kind === "cancel")) {
        setTask(null);
        say(DROPPED);
      } else if (turn.kind === "deny") {
        if (draft.state === "AWAITING_CONFIRM") {
          dispatch({ type: "reviewAgain" });
          say({ text: "Theek hai, bill abhi nahi kata. Jo badalna hai, boliye.", speech: "ठीक है, बिल अभी नहीं कटा। जो बदलना है, बोलिए।" });
        } else say({ text: "Theek hai.", speech: "ठीक है।" });
      } else if (turn.kind === "answer") {
        setAnswer(turn);
        speakHindi(turn.speech);
      } else if (locked) {
        say({
          text: "Yeh bill kat chuka hai. Naye maal ke liye Naya bill kholiye. Hisaab, vasooli ya vaada yahin bol sakte hain.",
          speech: "यह बिल कट चुका है। नए माल के लिए नया बिल खोलिए। हिसाब, वसूली या वादा यहीं बोल सकते हैं।",
        });
      } else if (turn.kind === "confirm") {
        if (draft.state === "AWAITING_CONFIRM" && fresh) {
          if (turn.assentOnly && answer) review();
          else void confirm();
        } else if (whatIsMissing(draft) || followUp) askNext(whatIsMissing(draft), followUp);
        else setError("Pehle bill ka hisaab sun lijiye, phir haan boliye.");
      } else if (turn.kind === "review") {
        if (whatIsMissing(draft) || followUp) askNext(whatIsMissing(draft), followUp);
        else review();
      } else if (turn.kind === "cancel") {
        setSuggestion(null);
        edit({ type: "cancel" });
        say({ text: "Bill radd kar diya. Kuch save nahi hua.", speech: "बिल रद्द कर दिया। कुछ सेव नहीं हुआ।" });
      } else if (turn.kind === "repeat") {
        dispatch({ type: "reviewAgain" });
        const prompt = nextVoiceQuestion(followUp, null) ?? {
          payment: ["Kitne rupaye mile, cash ya UPI mein? Rakam ke saath boliye.", "कितने रुपये मिले, कैश या यूपीआई में? रकम के साथ बोलिए।"],
          line: ["Kaunsi line badalni hai? Grade boliye, ya Likho mein badal dijiye.", "कौन सी लाइन बदलनी है? ग्रेड बोलिए, या लिखो में बदल दीजिए।"],
          unclear: ["Samajh nahi aaya. Aise boliye: “Manat ko 10 piece grade 1”, ya “Manat ne 5000 cash diye”.", "समझ नहीं आया। ऐसे बोलिए, मनत को दस पीस ग्रेड एक।"],
        }[turn.reason];
        setError(prompt[0]);
        speakHindi(prompt[1]);
      } else if (turn.kind === "edit") {
        const match = turn.match;
        const name = turn.name;
        const customer = match ? (match.kind === "found" ? match.customer : null) : draft.customer;
        const pending = turn.followUp === undefined ? followUp : turn.followUp;
        setFollowUp(pending);
        if (match && name) {
          setSuggestion(match.kind === "found" ? null : { name, match });
          setPickNote(match.kind === "found" && match.fuzzy ? `"${name}" se milta-julta naam chuna. Galat ho to Badlo.` : null);
          if (match.kind === "ambiguous") speakHindi("कौन से ग्राहक? पूरा नाम बोलिए, या सूची से चुन लीजिए।");
          if (match.kind === "not_found") speakHindi("यह नाम सूची में नहीं मिला। ग्राहक चुन लीजिए।");
        }
        if (match?.kind === "ambiguous" || match?.kind === "not_found") setVoiceQuestion(null);
        else askNext(whatIsMissing({ ...draft, ...turn.entries, customer }), pending);
        reviewRequested.current = !pending;
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
  const question = draft.state === "AWAITING_CONFIRM" && fresh
    ? preview?.data.credit === "over" ? "Limit se upar hai. Phir bhi bill kaat doon?" : "Hisaab dekh lo. Bill kaat doon?"
    : null;
  const customerQuestion = suggestion?.match.kind === "ambiguous"
    ? `Kaun se ${suggestion.name}? Poora naam boliye, ya list se chun lijiye.`
    : suggestion && `"${suggestion.name}" naam ka koi customer nahi mila. Naam phir se boliye, ya list se chun lijiye.`;
  const nextQuestion = customerQuestion ?? voiceQuestion ?? nextVoiceQuestion(followUp, null)?.[0];
  const pendingProblem = error ?? (previewError?.key === key ? previewError.message : null);
  const reply = pendingProblem ?? answer?.text ?? question ?? nextQuestion ?? null;
  const micDisabled = saving || voice === "interpreting" || customerOpen || likhoOpen;

  function submitText(text: string) {
    if (busy || micDisabled) return;
    startVoice();
    void finishVoice(text);
  }
  const panel = <EntryPanel items={draft.items} cash={draft.cash} upi={draft.upi} rates={rates} locked={locked || busy} dispatch={edit} />;

  return (
    <main className="workspace" data-mobile-view={mobileView}>
      <nav aria-label="Workspace view" className="view-switch">
        <button aria-pressed={mobileView === "chat"} onClick={() => setMobileView("chat")}><Icon name="chat" />Bolo</button>
        <button aria-pressed={mobileView === "bill"} onClick={() => setMobileView("bill")}><Icon name="receipt" />Bill
          {draft.items.length > 0 && <span className="item-count">{draft.items.length}</span>}
        </button>
      </nav>
      <section aria-labelledby="conversation-heading" className="conversation-panel">
        <h1 id="conversation-heading" className="sr-only">Bolo se baat</h1>
        <Conversation messages={messages} words={voice === "recording" ? words : ""}
          reply={voice === "idle" ? reply : null}
          onReplay={!pendingProblem && answer ? () => speakHindi(answer.speech) : !pendingProblem && question ? () => { if (fresh && preview) speakPreview(preview.data); } : null}
          onExample={submitText} disabled={busy || micDisabled} greeting={greeting} example={example}
          openBill={!locked && draft.customer ? draft.customer.name : null}>
          <MicButton disabled={micDisabled} onStart={startVoice} onWords={setWords}
            onFinish={(text, problem) => void finishVoice(text, problem)} />
        </Conversation>
        {draft.state === "AWAITING_CONFIRM" && <button className="mobile-review" onClick={() => setMobileView("bill")}>Bill dekho</button>}
        {locked && <button className="mobile-review" onClick={onNewBill}>Naya bill</button>}
        <Dock busy={busy} micDisabled={micDisabled} onType={submitText} onLikho={() => setLikhoOpen(true)} />
      </section>

      <aside id="bill-workspace" aria-label="Bill workspace" className="bill-pane">
        <section className="bill-paper">
          <header className="slip-head">
            <h2>{SLIP_TITLE[draft.state]}</h2>
            {draft.state === "AWAITING_CONFIRM" && <span className="slip-state">Haan ka intezaar</span>}
            {draft.state === "SAVED" && draft.billId !== null && <span className="slip-state saved">Bill {draft.billId}</span>}
          </header>
          <div className="bill-content">
            <CustomerHeader customer={draft.customer}
              account={preview?.data.customer.id === draft.customer?.id ? preview?.data.customer ?? null : null}
              note={pickNote} locked={locked || busy} onChange={() => setCustomerOpen(true)} />
            <Receipt draft={draft} preview={preview?.data ?? null} fresh={fresh} rates={rates} blocked={busy}
              onCancel={() => { setSuggestion(null); edit({ type: "cancel" }); }} />
            <button type="button" className={`bill-action ${action.tone === "danger" ? "danger" : ""}`}
              onClick={run} disabled={action.disabled || busy || Boolean(followUp)}>{action.label}</button>
            {!locked && (nextQuestion || hint) && <p className="bill-hint">{nextQuestion || hint}</p>}
          </div>
        </section>
        <section className="rate-strip" aria-labelledby="rates-title">
          <h2 id="rates-title">Aaj ke rate</h2>
          <dl>{([1, 2, 3] as const).map(grade =>
            <div key={grade}><dt>Grade {grade}</dt><dd>{formatRupees(rates[grade])}</dd></div>
          )}</dl>
          <Link href="/app/profile" className="text-link">Badlo</Link>
        </section>
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
