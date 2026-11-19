"use client";
// Customer search in a bottom sheet. Several matches become big buttons: "Kaun sa Afzal?"
import { useState, type FormEvent } from "react";
import { Drawer } from "vaul";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import { addCustomer, friendlyError, searchCustomers } from "./api-client.ts";

type Props = {
  open: boolean;
  suggestion: { name: string; match: CustomerMatch } | null;
  onOpenChange: (open: boolean) => void;
  onPick: (customer: Customer, fuzzyFrom?: string) => void;
};

const bigChoice =
  "flex h-16 w-full items-center rounded-xl border-2 border-line bg-paper px-4 text-left text-xl font-semibold outline-coconut hover:border-ink focus-visible:outline-3";

export function CustomerSheet({ open, suggestion, onOpenChange, onPick }: Props) {
  const [text, setText] = useState(suggestion?.name ?? "");
  const [asked, setAsked] = useState(suggestion?.name ?? "");
  const [match, setMatch] = useState<CustomerMatch | null>(suggestion?.match ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(customer: Customer, fuzzyFrom?: string) {
    onPick(customer, fuzzyFrom);
    setText("");
    setMatch(null);
    setProblem(null);
    onOpenChange(false);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const typed = text.trim();
    if (!typed || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await searchCustomers(typed);
      setAsked(typed);
      if (result.kind === "found") choose(result.customer, result.fuzzy ? typed : undefined);
      else setMatch(result);
    } catch (error) {
      setProblem(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function addNew() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      choose(await addCustomer(asked));
    } catch (error) {
      setProblem(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={!busy}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-2xl bg-canvas outline-none">
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" />
          <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
            <Drawer.Title className="text-xl font-semibold">Choose customer</Drawer.Title>
            <Drawer.Description className="text-muted">Type a name, like Afzal or Manat.</Drawer.Description>

            <form onSubmit={search} className="mt-4 flex gap-2">
              <label htmlFor="customer-search" className="sr-only">Customer name</label>
              <input
                id="customer-search"
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
                className="h-14 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 text-xl outline-coconut focus-visible:outline-2"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="h-14 rounded-xl bg-ink px-5 text-lg font-semibold text-white outline-coconut outline-offset-2 focus-visible:outline-3 disabled:opacity-40"
              >
                Search
              </button>
            </form>

            {problem && <p role="alert" className="mt-3 font-medium text-red">{problem}</p>}

            {match?.kind === "ambiguous" && (
              <div className="mt-5">
                <p className="text-lg font-semibold">Which {asked}?</p>
                <ul className="mt-3 space-y-2">
                  {match.options.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => choose(c)} disabled={busy} className={bigChoice}>{c.name}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {match?.kind === "not_found" && (
              <div className="mt-5">
                <p className="text-lg font-semibold">&ldquo;{asked}&rdquo; is not in your list. Is this a new customer?</p>
                <button
                  onClick={addNew}
                  disabled={busy}
                  className="mt-3 h-16 w-full rounded-xl bg-coconut text-xl font-semibold text-white outline-coconut outline-offset-2 hover:bg-coconut-deep focus-visible:outline-3"
                >
                  Yes, add {asked}
                </button>
                <p className="mt-2 text-sm text-muted">A new customer starts with a ₹0 credit limit.</p>
              </div>
            )}

            {match?.kind === "unclear" && <p className="mt-5 text-lg font-semibold">Couldn&apos;t read that name. Please type it again.</p>}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
