"use client";
// Find the customer by name. Several matches: ask. No match: offer to add.
import { useState, type FormEvent } from "react";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import { addCustomer, friendlyError, searchCustomers } from "./api-client.ts";

type Props = { selected: Customer | null; disabled: boolean; onPick: (customer: Customer) => void };

export function CustomerPicker({ selected, disabled, onPick }: Props) {
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const [match, setMatch] = useState<CustomerMatch | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function choose(customer: Customer, fuzzyFrom?: string) {
    onPick(customer);
    setMatch(null);
    setText("");
    setNote(fuzzyFrom ? `"${fuzzyFrom}" se milta-julta naam chuna. Galat ho to doosra dhundo.` : null);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const typed = text.trim();
    try {
      const result = await searchCustomers(typed);
      setAsked(typed);
      if (result.kind === "found") choose(result.customer, result.fuzzy ? typed : undefined);
      else setMatch(result);
    } catch (error) {
      setNote(friendlyError(error));
    }
  }

  async function addNew() {
    try {
      choose(await addCustomer(asked));
    } catch (error) {
      setNote(friendlyError(error));
    }
  }

  return (
    <section aria-labelledby="customer-heading">
      <h2 id="customer-heading" className="text-lg font-semibold">Customer</h2>
      {selected && <p className="mt-1 text-3xl font-semibold text-brand">{selected.name}</p>}
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}

      <form onSubmit={search} className="mt-3 flex max-w-md gap-2">
        <label htmlFor="customer-search" className="sr-only">Customer ka naam</label>
        <input
          id="customer-search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          placeholder={selected ? "Doosra customer dhundo" : "Naam likho, jaise Afzal"}
          className="h-12 min-w-0 flex-1 rounded-lg border border-rule px-3 text-lg outline-brand focus-visible:outline-2 disabled:bg-ground"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="h-12 rounded-lg bg-ink px-5 font-semibold text-white outline-brand outline-offset-2 focus-visible:outline-2 disabled:opacity-40"
        >
          Dhundo
        </button>
      </form>

      {match?.kind === "ambiguous" && (
        <div className="mt-3">
          <p className="font-medium">Kaun sa {asked}?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {match.options.map((c) => (
              <button
                key={c.id}
                onClick={() => choose(c)}
                className="h-12 rounded-lg border-2 border-brand px-4 font-semibold text-brand outline-brand outline-offset-2 hover:bg-ground focus-visible:outline-2"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {match?.kind === "not_found" && (
        <div className="mt-3">
          <p className="font-medium">&ldquo;{asked}&rdquo; list mein nahi hai. Naya customer hai?</p>
          <button
            onClick={addNew}
            className="mt-2 h-12 rounded-lg border-2 border-brand px-4 font-semibold text-brand outline-brand outline-offset-2 hover:bg-ground focus-visible:outline-2"
          >
            Haan, {asked} ko add karo
          </button>
          <p className="mt-1 text-sm text-muted">Naye customer ki limit ₹0 se shuru hoti hai.</p>
        </div>
      )}

      {match?.kind === "unclear" && <p className="mt-3 font-medium">Naam samajh nahi aaya. Phir se likho.</p>}
    </section>
  );
}
