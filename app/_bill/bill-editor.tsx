"use client";
// The kaccha bill, editable in place: lines, a new line, payment with quick buttons, and the limit bar.
import { useState } from "react";
import type { CreditStatus, Grade, ItemInput, Unit } from "@/lib/billing.ts";
import { limitShare, paymentFor, type QuickPayment } from "@/lib/draft.ts";
import { formatRupees as r, parseRupees, rs } from "@/lib/money.ts";
import { wholeNumber } from "./api-client.ts";

const GRADES: Grade[] = [1, 2, 3];

type LineProps = {
  index: number; item: ItemInput; listRate: number; amount: number | null; locked: boolean; lit: boolean;
  update: (changes: Partial<ItemInput>) => void; remove: () => void;
};

// One line: grade chips, a stepper you can also type into, piece or crate, and the rate.
export function LineEditor({ index, item, listRate, amount, locked, lit, update, remove }: LineProps) {
  const n = index + 1;
  return (
    <li className={`edit-line ${lit ? "is-lit" : ""}`}>
      <div className="edit-line-row">
        <div className="grade-chips" role="group" aria-label={`Line ${n}, grade`}>
          {GRADES.map((grade) => (
            <button key={grade} type="button" aria-pressed={item.grade === grade} disabled={locked}
              onClick={() => update({ grade })}>Grade {grade}</button>
          ))}
        </div>
        <span className="line-amount">{amount === null ? "…" : r(amount)}</span>
      </div>
      <div className="edit-line-row">
        <div className="stepper">
          <button type="button" aria-label={`Line ${n}, ek kam`} disabled={locked || item.qty <= 1}
            onClick={() => update({ qty: Math.max(1, item.qty - 1) })}>−</button>
          <input aria-label={`Line ${n}, kitne`} inputMode="numeric" value={item.qty ? String(item.qty) : ""} disabled={locked}
            onChange={(e) => update({ qty: wholeNumber(e.target.value) ?? 0 })} />
          <button type="button" aria-label={`Line ${n}, ek zyada`} disabled={locked}
            onClick={() => update({ qty: item.qty + 1 })}>+</button>
        </div>
        <button type="button" className="unit-toggle" disabled={locked} aria-label={`Line ${n}, ${item.unit === "crate" ? "crate" : "piece"}; badalne ke liye dabaiye`}
          onClick={() => update({ unit: item.unit === "crate" ? "piece" : "crate" })}>{item.unit === "crate" ? "crate" : "piece"}</button>
        <RateField n={n} rate={item.rate} listRate={listRate} locked={locked} update={update} />
        <button type="button" className="line-remove" disabled={locked} onClick={remove} aria-label={`Line ${n} hatao`}>Hatao</button>
      </div>
    </li>
  );
}

// Empty means the price list; a typed rate is marked "badla" and can go back to the list in one tap.
function RateField({ n, rate, listRate, locked, update }: { n: number; rate: number | undefined; listRate: number; locked: boolean; update: LineProps["update"] }) {
  return (
    <span className="rate-field">
      <span aria-hidden>× ₹</span>
      <input aria-label={`Line ${n}, rate`} inputMode="numeric" placeholder={String(listRate / 100)} disabled={locked}
        value={rate !== undefined ? String(rate / 100) : ""}
        onChange={(e) => {
          const value = wholeNumber(e.target.value);
          if (e.target.value === "") update({ rate: undefined });
          else if (value) update({ rate: rs(value) });
        }} />
      {rate !== undefined && rate !== listRate && (
        <button type="button" className="rate-badla" disabled={locked} onClick={() => update({ rate: undefined })}
          title={`List rate ${r(listRate)} wapas lagao`}>badla</button>
      )}
    </span>
  );
}

// "Kitne" then a grade button adds the line. Likho focuses this box.
export function AddLine({ locked, add }: { locked: boolean; add: (item: ItemInput) => void }) {
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("piece");
  const [hint, setHint] = useState("");

  function addGrade(grade: Grade) {
    const n = wholeNumber(qty);
    if (!n) {
      setHint("Pehle likhiye kitne piece ya crate.");
      document.getElementById("add-qty")?.focus();
      return;
    }
    add(unit === "crate" ? { grade, qty: n, unit } : { grade, qty: n });
    setQty("");
    setHint("");
  }

  return (
    <div className="add-line">
      <div className="add-line-row">
        <label className="sr-only" htmlFor="add-qty">Naya maal, kitne</label>
        <input id="add-qty" className="add-qty" inputMode="numeric" placeholder="Kitne" value={qty} disabled={locked}
          onChange={(e) => setQty(e.target.value)} />
        <button type="button" className="unit-toggle" disabled={locked} onClick={() => setUnit(unit === "crate" ? "piece" : "crate")}
          aria-label={`Naya maal ${unit}; badalne ke liye dabaiye`}>{unit}</button>
        {GRADES.map((grade) => (
          <button key={grade} type="button" className="add-grade" disabled={locked} onClick={() => addGrade(grade)}>+ Grade {grade}</button>
        ))}
      </div>
      {hint && <p className="form-error" role="alert">{hint}</p>}
    </div>
  );
}

// Show paise only when there are any: 600000 -> "6000", 600050 -> "6000.50".
const asText = (paise: number) => (paise === 0 ? "" : paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2));

// A money box that keeps what you are typing ("250.") and takes new values from outside (quick buttons).
function MoneyBox({ label, value, locked, onChange }: { label: string; value: number; locked: boolean; onChange: (paise: number) => void }) {
  const [text, setText] = useState(asText(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(asText(value));
  }
  return (
    <label className="money-box">
      <span>{label}</span>
      <span className="money-input">
        <span aria-hidden>₹</span>
        <input inputMode="decimal" placeholder="0" value={text} disabled={locked}
          onChange={(e) => {
            setText(e.target.value);
            const paise = e.target.value.trim() === "" ? 0 : parseRupees(e.target.value);
            if (paise !== null) {
              setShown(paise);
              onChange(paise);
            }
          }} />
      </span>
    </label>
  );
}

const QUICK: [QuickPayment, string][] = [["cash", "Poora cash"], ["half", "Aadha cash"], ["upi", "Poora UPI"], ["udhaar", "Sab udhaar"]];

// Cash and UPI, plus quick buttons that use the server's total, so the screen does no money maths.
export function PaymentEditor({ cash, upi, total, locked, setPayment }: {
  cash: number; upi: number; total: number | null; locked: boolean; setPayment: (payment: { cash?: number; upi?: number }) => void;
}) {
  return (
    <div className="pay-edit">
      <div className="pay-boxes">
        <MoneyBox label="Cash" value={cash} locked={locked} onChange={(paise) => setPayment({ cash: paise })} />
        <MoneyBox label="UPI" value={upi} locked={locked} onChange={(paise) => setPayment({ upi: paise })} />
      </div>
      <div className="quick-pay" role="group" aria-label="Jaldi payment">
        {QUICK.map(([choice, label]) => {
          const pay = total === null ? null : paymentFor(choice, total);
          return (
            <button key={choice} type="button" disabled={locked || pay === null}
              aria-pressed={pay !== null && pay.cash === cash && pay.upi === upi}
              onClick={() => pay && setPayment(pay)}>{label}</button>
          );
        })}
      </div>
    </div>
  );
}

const LIMIT_WORDS: Record<CreditStatus, string> = { ok: "Limit mein", near: "Limit ke paas", over: "Limit se upar" };

// How full the credit limit will be after this bill.
export function LimitBar({ newOutstanding, limit, credit, overBy }: { newOutstanding: number; limit: number; credit: CreditStatus; overBy: number }) {
  const share = limitShare(newOutstanding, limit);
  return (
    <div className={`limit-bar credit-${credit}`}>
      <div className="limit-track" role="img" aria-label={`Credit limit ka ${share}% bharega`}>
        <span style={{ width: `${share}%` }} />
      </div>
      <p>
        <strong>{LIMIT_WORDS[credit]}</strong>
        {credit === "over" ? `, ${r(overBy)} upar` : `, ${share}% bharega`}
        <span className="limit-of"> Limit {r(limit)}</span>
      </p>
    </div>
  );
}

