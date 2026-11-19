"use client";
// Add maal: type how many, tap the grade. Fix qty or rate on any line.
import { useState, type Dispatch } from "react";
import type { BillLine, Grade, ItemInput, RateCard } from "@/lib/billing.ts";
import type { Action } from "@/lib/draft.ts";
import { formatRupees, rs } from "@/lib/money.ts";
import { wholeNumber } from "./api-client.ts";

const GRADES: Grade[] = [1, 2, 3];
const field =
  "h-11 rounded-lg border border-rule px-2 text-right text-lg tabular-nums outline-brand focus-visible:outline-2 disabled:bg-ground disabled:text-muted";

type Props = {
  items: ItemInput[];
  lines: BillLine[] | null;
  rates: RateCard;
  disabled: boolean;
  dispatch: Dispatch<Action>;
};

export function ItemsEditor({ items, lines, rates, disabled, dispatch }: Props) {
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
    <section aria-labelledby="maal-heading">
      <h2 id="maal-heading" className="text-lg font-semibold">Maal</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium">Kitne piece</span>
          <input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={disabled}
            placeholder="10"
            className={`${field} mt-1 block h-14 w-28 text-2xl`}
          />
        </label>
        <div className="grid flex-1 grid-cols-3 gap-2 sm:max-w-md">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => add(g)}
              disabled={disabled}
              className="h-14 rounded-lg bg-brand px-2 text-white outline-brand outline-offset-2 hover:bg-brand-deep focus-visible:outline-2 disabled:opacity-40"
            >
              <span className="block font-semibold leading-tight">Grade {g}</span>
              <span className="block text-sm leading-tight opacity-85">{formatRupees(rates[g])}</span>
            </button>
          ))}
        </div>
      </div>
      {hint && <p role="status" className="mt-2 text-sm font-medium text-amber-800">{hint}</p>}

      {items.length > 0 && (
        <ul className="mt-4 max-w-2xl">
          {items.map((item, i) => (
            <LineRow key={i} index={i} item={item} line={lines?.[i] ?? null} listRate={rates[item.grade]} disabled={disabled} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </section>
  );
}

type RowProps = { index: number; item: ItemInput; line: BillLine | null; listRate: number; disabled: boolean; dispatch: Dispatch<Action> };

// One line: Grade 1  [10] piece x ₹[1500]  ₹15,000  Hatao
function LineRow({ index, item, line, listRate, disabled, dispatch }: RowProps) {
  const update = (changes: Partial<ItemInput>) => dispatch({ type: "updateItem", index, changes });
  const ownRate = item.rate !== undefined;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-rule py-2">
      <span className="w-16 font-semibold">Grade {item.grade}</span>
      <input
        aria-label={`Line ${index + 1}, kitne piece`}
        inputMode="numeric"
        value={item.qty ? String(item.qty) : ""}
        onChange={(e) => update({ qty: wholeNumber(e.target.value) ?? 0 })}
        disabled={disabled}
        className={`${field} w-16`}
      />
      <span className="text-muted">{item.unit ?? "piece"} ×</span>
      <span className="text-muted">₹</span>
      <input
        aria-label={`Line ${index + 1}, rate`}
        inputMode="numeric"
        value={ownRate ? String((item.rate as number) / 100) : ""}
        placeholder={String(listRate / 100)}
        onChange={(e) => {
          const n = wholeNumber(e.target.value);
          if (e.target.value === "") update({ rate: undefined });
          else if (n !== null) update({ rate: rs(n) });
        }}
        disabled={disabled}
        className={`${field} w-20 ${ownRate ? "font-semibold text-brand" : ""}`}
      />
      <span className="ml-auto min-w-20 text-right text-lg font-medium tabular-nums">
        {line ? formatRupees(line.amount) : "…"}
      </span>
      <button
        onClick={() => dispatch({ type: "removeItem", index })}
        disabled={disabled}
        aria-label={`Line ${index + 1} hatao`}
        className="h-11 rounded-lg px-3 text-sm font-medium text-muted outline-brand hover:bg-ground hover:text-ink focus-visible:outline-2 disabled:invisible"
      >
        Hatao
      </button>
    </li>
  );
}
