"use client";
// "Likho": add maal and payment by touch. A sheet on phones, a side panel on tablets.
import { useState, type Dispatch } from "react";
import type { Grade, ItemInput, RateCard } from "@/lib/billing.ts";
import type { Action } from "@/lib/draft.ts";
import { formatRupees, rs } from "@/lib/money.ts";
import { wholeNumber } from "./api-client.ts";

const GRADES: Grade[] = [1, 2, 3];
const box =
  "h-12 rounded-lg border border-line bg-paper px-2 text-right text-lg outline-coconut focus-visible:outline-2 disabled:bg-canvas disabled:text-muted";

type Props = { items: ItemInput[]; cash: number; upi: number; rates: RateCard; locked: boolean; dispatch: Dispatch<Action> };

export function EntryPanel({ items, cash, upi, rates, locked, dispatch }: Props) {
  const [qty, setQty] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  function add(grade: Grade) {
    const n = wholeNumber(qty);
    if (!n) return setHint("Pehle likho kitne piece.");
    dispatch({ type: "addItem", item: { grade, qty: n } });
    setQty("");
    setHint(null);
  }

  return (
    <div className="space-y-7">
      <section aria-labelledby="maal-heading">
        <h2 id="maal-heading" className="text-lg font-semibold">Maal</h2>
        <label className="mt-2 block">
          <span className="text-sm text-muted">Kitne piece</span>
          <input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={locked}
            placeholder="10"
            className={`${box} mt-1 block h-14 w-full text-2xl`}
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => add(g)}
              disabled={locked}
              className="h-16 rounded-xl border-2 border-ink bg-paper outline-coconut outline-offset-2 hover:bg-canvas focus-visible:outline-3 disabled:opacity-40"
            >
              <span className="block text-lg font-semibold leading-tight">Grade {g}</span>
              <span className="block text-sm leading-tight text-muted">{formatRupees(rates[g])}</span>
            </button>
          ))}
        </div>
        {hint && <p role="status" className="mt-2 font-medium text-red">{hint}</p>}

        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {items.map((item, i) => (
              <LineEdit key={i} index={i} item={item} listRate={rates[item.grade]} locked={locked} dispatch={dispatch} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading" className="text-lg font-semibold">Payment</h2>
        <p className="text-sm text-muted">Jo abhi mila. Baaki udhaar mein jayega.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Money label="Cash" value={cash} locked={locked} onChange={(p) => dispatch({ type: "setPayment", cash: p })} />
          <Money label="UPI" value={upi} locked={locked} onChange={(p) => dispatch({ type: "setPayment", upi: p })} />
        </div>
      </section>
    </div>
  );
}

type LineProps = { index: number; item: ItemInput; listRate: number; locked: boolean; dispatch: Dispatch<Action> };

// Fix one line: piece count, own rate (empty = price list), or remove it.
function LineEdit({ index, item, listRate, locked, dispatch }: LineProps) {
  const update = (changes: Partial<ItemInput>) => dispatch({ type: "updateItem", index, changes });
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-16 font-semibold">Grade {item.grade}</span>
      <input
        aria-label={`Line ${index + 1}, kitne piece`}
        inputMode="numeric"
        value={item.qty ? String(item.qty) : ""}
        onChange={(e) => update({ qty: wholeNumber(e.target.value) ?? 0 })}
        disabled={locked}
        className={`${box} w-16`}
      />
      <span className="text-muted">× ₹</span>
      <input
        aria-label={`Line ${index + 1}, rate`}
        inputMode="numeric"
        value={item.rate !== undefined ? String(item.rate / 100) : ""}
        placeholder={String(listRate / 100)}
        onChange={(e) => {
          const n = wholeNumber(e.target.value);
          if (e.target.value === "") update({ rate: undefined });
          else if (n !== null) update({ rate: rs(n) });
        }}
        disabled={locked}
        className={`${box} w-20`}
      />
      <button
        onClick={() => dispatch({ type: "removeItem", index })}
        disabled={locked}
        aria-label={`Line ${index + 1} hatao`}
        className="ml-auto h-12 rounded-lg px-3 font-medium text-red outline-coconut hover:bg-canvas focus-visible:outline-2 disabled:invisible"
      >
        Hatao
      </button>
    </li>
  );
}

type MoneyProps = { label: string; value: number; locked: boolean; onChange: (paise: number) => void };

function Money({ label, value, locked, onChange }: MoneyProps) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label} (₹)</span>
      <input
        inputMode="numeric"
        value={value ? String(value / 100) : ""}
        placeholder="0"
        disabled={locked}
        onChange={(e) => {
          const n = wholeNumber(e.target.value);
          if (e.target.value === "") onChange(0);
          else if (n !== null) onChange(rs(n));
        }}
        className={`${box} mt-1 block h-14 w-full text-2xl`}
      />
    </label>
  );
}
