"use client";
// Conversation and bill share a draft until the owner confirms the sale.
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import type { BillPreview, LedgerTask } from "@/lib/api.ts";
import type { RateCard } from "@/lib/billing.ts";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import { billReducer, changedLines, newDraft, newDraftId, openEntries, startDraft, whatIsMissing, type Action, type BillDraft, type StartNote } from "@/lib/draft.ts";
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

// The slip's title: a draft until the owner says yes, then the final bill.
const SLIP_TITLE: Record<BillDraft["state"], string> = {
  DRAFT: "Draft bill", AWAITING_CONFIRM: "Draft bill", SAVED: "Final bill", CANCELLED: "Cancelled bill",
};
type Fresh = { preview: BillPreview | null; fresh: boolean };
type CustomerSuggestion = { name: string; match: CustomerMatch };

function speakPreview(preview: BillPreview) {
  const lines = preview.lines.map((line) => `ग्रेड ${line.grade} के ${line.qty} ${line.unit === "crate" ? "क्रेट" : "पीस"}।`);
  speakHindi([...lines, hindiReadBack({ ...preview, customerName: preview.customer.name })].join(" "));
}

function nextVoiceQuestion(followUp: FollowUp | null, missing: ReturnType<typeof whatIsMissing>) {
  if (followUp?.kind === "grade") {
    return [`${followUp.qty} ${followUp.unit} noted. Which grade: 1, 2 or 3?`, `${followUp.qty} ${followUp.unit === "crate" ? "क्रेट" : "पीस"} लिख लिए। कौन सा ग्रेड, एक, दो या तीन?`];
  }
  if (followUp?.kind === "payment") {
    if (followUp.mode === "cash") return ["How much cash? Say the amount.", "कितना कैश मिला? रकम बोलिए।"];
    if (followUp.mode === "upi") return ["How much by UPI? Say the amount.", "यूपीआई से कितना आया? रकम बोलिए।"];
    return ["How much was paid, in cash or UPI?", "कितने रुपये मिले, कैश या यूपीआई में?"];
  }
  if (missing === "customer") return ["Whose bill is this?", "किसके नाम का बिल बनाऊँ?"];
  if (missing === "items") return ["What items? Say the pieces or crates and the grade.", "कितना माल देना है? पीस या क्रेट, और ग्रेड बोलिए।"];
  return null;
}

// The one big button changes with the bill's state. Nothing saves without a yes.
function mainAction(draft: BillDraft, { preview, fresh }: Fresh, saving: boolean): { action: MainAction; hint: string | null } {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") {
    return { action: { label: "New bill", tone: "go", disabled: false }, hint: null };
  }
  if (draft.state === "AWAITING_CONFIRM") {
    const over = preview?.credit === "over";
    const label = saving ? "Saving…" : over ? "Over limit, save anyway" : "Yes, save bill";
    return { action: { label, tone: over ? "danger" : "go", disabled: saving || !fresh }, hint: null };
  }
  const missing = whatIsMissing(draft);
  const hint =
    missing === "customer" ? "Choose a customer first." :
    missing === "items" ? "Say the quantity and grade, or add items on the bill." :
    (preview?.overpaidBy ?? 0) > 0 ? "Fix the cash or UPI amount." :
    !fresh ? "Working out the bill…" : null;
  return { action: { label: "Review bill", tone: "go", disabled: Boolean(hint) }, hint };
}

type WorkspaceProps = Omit<ScreenProps, "shopKey"> & { storageKey: string; firstRound: boolean; onNewBill: () => void };

// What to tell the owner about how this bill started.
function startMessage(note: StartNote, draft: BillDraft, asked: Customer | null): string | null {
  if (note !== "restored") return null;
  if (asked && asked.id !== draft.customer?.id) return `An unfinished bill is open. Make ${asked.name}'s bill after this one.`;
  return "Your unfinished bill is back. Check it and carry on.";
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
  // The bill before each change, newest last, so "Wapas karo" (Ctrl+Z) can undo. A new bill starts empty.
  const [history, setHistory] = useState<BillDraft[]>([]);
  // Lines voice just changed, lit up for a moment so the owner sees what moved.
  const [lit, setLit] = useState<number[]>([]);
  const undoRef = useRef<() => void>(() => {});

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
    if (!reviewRequested.current || voice !== "idle" || customerOpen || saving ||
        draft.state !== "DRAFT" || followUp || whatIsMissing(draft) || !fresh || !preview) return;
    reviewRequested.current = false;
    speakPreview(preview.data);
    if (!preview.data.overpaidBy) dispatch({ type: "readBack", draftId: newDraftId() });
  }, [customerOpen, draft, followUp, fresh, preview, saving, voice]);

  useEffect(() => {
    if (lit.length === 0) return;
    const timer = setTimeout(() => setLit([]), 1600);
    return () => clearTimeout(timer);
  }, [lit]);

  // Ctrl+Z (Cmd+Z) undoes the last bill change, except while typing in a box.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        undoRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function remember() {
    setHistory((past) => [...past.slice(-19), draft]);
  }

  function edit(action: Action, record = true) {
    if (record && action.type !== "cancel" && draft.state !== "SAVED" && draft.state !== "CANCELLED") remember();
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
    setPickNote(fuzzyFrom ? `Picked the closest name to "${fuzzyFrom}". Tap Change if it's wrong.` : null);
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
        return setError("The bill changed. Check the new total and say yes again.");
      }
      dispatch({ type: "saved", billId: result.billId });
      const who = draft.customer?.name ?? "";
      say({
        text: `Bill ${result.billId} saved. ${who}'s credit is now ${formatRupees(result.newOutstanding)}. Ready for the next bill.`,
        speech: `बिल कट गया। ${who} का उधार अब ${formatRupees(result.newOutstanding).slice(1)} रुपये है।`,
      });
      // Toast after the stamp has landed (at once when motion is reduced).
      const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
      const name = draft.customer?.name ?? "";
      setTimeout(() => toast.success(`Bill ${result.billId} saved`, { description: `${name}'s credit is now ${formatRupees(result.newOutstanding)}` }), wait);
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

  // Undo is an edit: the bill goes back to kaccha and needs a new read-back before "haan".
  function undo() {
    const last = history.at(-1);
    if (!last || saving || voice !== "idle" || draft.state === "SAVED" || draft.state === "CANCELLED") return;
    setHistory((past) => past.slice(0, -1));
    edit({ type: "revert", to: last }, false);
  }
  useEffect(() => {
    undoRef.current = undo;
  });

  // Likho: show the bill and put the cursor in the new-line box.
  function openEditor() {
    setMobileView("bill");
    requestAnimationFrame(() => document.getElementById("add-qty")?.focus());
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
        if (problem.startsWith("I couldn't hear")) speakHindi("मुझे साफ़ सुनाई नहीं दिया। एक बार फिर बोलें।");
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
      const turn = await interpretBill(text, openEntries(draft), draft.customer?.id ?? null, followUp, accountQuestion, controller.signal);
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
          say({ text: "Okay, the bill is not saved yet. Tell me what to change.", speech: "ठीक है, बिल अभी नहीं कटा। जो बदलना है, बोलिए।" });
        } else say({ text: "Okay.", speech: "ठीक है।" });
      } else if (turn.kind === "answer") {
        setAnswer(turn);
        speakHindi(turn.speech);
      } else if (locked) {
        say({
          text: "This bill is already saved. Open a new bill for more items. You can still ask about accounts, payments or promises here.",
          speech: "यह बिल कट चुका है। नए माल के लिए नया बिल खोलिए। हिसाब, वसूली या वादा यहीं बोल सकते हैं।",
        });
      } else if (turn.kind === "confirm") {
        if (draft.state === "AWAITING_CONFIRM" && fresh) {
          if (turn.assentOnly && answer) review();
          else void confirm();
        } else if (whatIsMissing(draft) || followUp) askNext(whatIsMissing(draft), followUp);
        else setError("Review the bill first, then say yes.");
      } else if (turn.kind === "review") {
        if (whatIsMissing(draft) || followUp) askNext(whatIsMissing(draft), followUp);
        else review();
      } else if (turn.kind === "cancel") {
        setSuggestion(null);
        edit({ type: "cancel" });
        say({ text: "Bill cancelled. Nothing was saved.", speech: "बिल रद्द कर दिया। कुछ सेव नहीं हुआ।" });
      } else if (turn.kind === "repeat") {
        dispatch({ type: "reviewAgain" });
        const prompt = nextVoiceQuestion(followUp, null) ?? {
          payment: ["How much was paid, in cash or UPI? Say it with the amount.", "कितने रुपये मिले, कैश या यूपीआई में? रकम के साथ बोलिए।"],
          line: ["Which line should change? Say the grade, or edit it on the bill.", "कौन सी लाइन बदलनी है? ग्रेड बोलिए, या लिखो में बदल दीजिए।"],
          unclear: ["I didn't catch that. Try “Manat ko 10 piece grade 1”, or “Manat ne 5000 cash diye”.", "समझ नहीं आया। ऐसे बोलिए, मनत को दस पीस ग्रेड एक।"],
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
          setPickNote(match.kind === "found" && match.fuzzy ? `Picked the closest name to "${name}". Tap Change if it's wrong.` : null);
          if (match.kind === "ambiguous") speakHindi("कौन से ग्राहक? पूरा नाम बोलिए, या सूची से चुन लीजिए।");
          if (match.kind === "not_found") speakHindi("यह नाम सूची में नहीं मिला। ग्राहक चुन लीजिए।");
        }
        if (match?.kind === "ambiguous" || match?.kind === "not_found") setVoiceQuestion(null);
        else askNext(whatIsMissing({ ...draft, ...turn.entries, customer }), pending);
        reviewRequested.current = !pending;
        remember();
        setLit(changedLines(draft.items, turn.entries.items));
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
    ? preview?.data.credit === "over" ? "Over the credit limit. Save the bill anyway?" : "Check the bill. Shall I save it?"
    : null;
  const customerQuestion = suggestion?.match.kind === "ambiguous"
    ? `Which ${suggestion.name}? Say the full name, or pick from the list.`
    : suggestion && `No customer called "${suggestion.name}". Say the name again, or pick from the list.`;
  const nextQuestion = customerQuestion ?? voiceQuestion ?? nextVoiceQuestion(followUp, null)?.[0];
  const pendingProblem = error ?? (previewError?.key === key ? previewError.message : null);
  const reply = pendingProblem ?? answer?.text ?? question ?? nextQuestion ?? null;
  const micDisabled = saving || voice === "interpreting" || customerOpen;

  function submitText(text: string) {
    if (busy || micDisabled) return;
    startVoice();
    void finishVoice(text);
  }

  return (
    <main className="workspace" data-mobile-view={mobileView}>
      <nav aria-label="Workspace view" className="view-switch">
        <button aria-pressed={mobileView === "chat"} onClick={() => setMobileView("chat")}><Icon name="chat" />Bolo</button>
        <button aria-pressed={mobileView === "bill"} onClick={() => setMobileView("bill")}><Icon name="receipt" />Bill
          {draft.items.length > 0 && <span className="item-count">{draft.items.length}</span>}
        </button>
      </nav>
      <section aria-labelledby="conversation-heading" className="conversation-panel">
        <h1 id="conversation-heading" className="sr-only">Talk to Bolo</h1>
        <Conversation messages={messages} words={voice === "recording" ? words : ""}
          reply={voice === "idle" ? reply : null}
          onReplay={!pendingProblem && answer ? () => speakHindi(answer.speech) : !pendingProblem && question ? () => { if (fresh && preview) speakPreview(preview.data); } : null}
          onExample={submitText} disabled={busy || micDisabled} greeting={greeting} example={example}
          openBill={!locked && draft.customer ? draft.customer.name : null}>
          <MicButton disabled={micDisabled} onStart={startVoice} onWords={setWords}
            onFinish={(text, problem) => void finishVoice(text, problem)} />
        </Conversation>
        {!locked && (draft.customer || draft.items.length > 0) && (
          <button type="button" className="mini-bill" onClick={() => setMobileView("bill")} aria-label="Open the bill">
            <span className="mini-bill-name">{draft.customer?.name ?? "Choose customer"}</span>
            <span>{draft.items.length} maal</span>
            <strong>{fresh && preview ? formatRupees(preview.data.total) : "…"}</strong>
            <span className="mini-bill-state">{draft.state === "AWAITING_CONFIRM" ? "Waiting for yes" : "Draft"}</span>
          </button>
        )}
        {locked && <button className="mobile-review" onClick={onNewBill}>New bill</button>}
        <Dock busy={busy} micDisabled={micDisabled} onType={submitText} onLikho={openEditor} />
      </section>

      <aside id="bill-workspace" aria-label="Bill workspace" className="bill-pane">
        <section className="bill-paper">
          <header className="slip-head">
            <h2>{SLIP_TITLE[draft.state]}</h2>
            {draft.state === "AWAITING_CONFIRM" && <span className="slip-state">Waiting for yes</span>}
            {draft.state === "SAVED" && draft.billId !== null && <span className="slip-state saved">Bill {draft.billId}</span>}
            {!locked && history.length > 0 && (
              <button type="button" className="slip-undo" onClick={undo} disabled={busy} title="Undo the last change (Ctrl+Z)">Undo</button>
            )}
          </header>
          <div className="bill-content">
            <CustomerHeader customer={draft.customer}
              account={preview?.data.customer.id === draft.customer?.id ? preview?.data.customer ?? null : null}
              note={pickNote} locked={locked || busy} onChange={() => setCustomerOpen(true)} />
            <Receipt draft={draft} preview={preview?.data ?? null} fresh={fresh} rates={rates} blocked={busy}
              lit={lit} onEdit={edit} onCancel={() => { setSuggestion(null); edit({ type: "cancel" }); }} />
            <button type="button" className={`bill-action ${action.tone === "danger" ? "danger" : ""}`}
              onClick={run} disabled={action.disabled || busy || Boolean(followUp)}>{action.label}</button>
            {!locked && (nextQuestion || hint) && <p className="bill-hint">{nextQuestion || hint}</p>}
          </div>
        </section>
        <section className="rate-strip" aria-labelledby="rates-title">
          <h2 id="rates-title">Today&apos;s rates</h2>
          <dl>{([1, 2, 3] as const).map(grade =>
            <div key={grade}><dt>Grade {grade}</dt><dd>{formatRupees(rates[grade])}</dd></div>
          )}</dl>
          <Link href="/app/profile" className="text-link">Change</Link>
        </section>
      </aside>

      <CustomerSheet key={suggestion ? `voice:${suggestion.name}` : "manual"} open={customerOpen} suggestion={suggestion} onOpenChange={setCustomerOpen} onPick={pick} />

    </main>
  );
}
