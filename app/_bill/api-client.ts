// Browser calls to our API routes. Type-only imports, so no server code reaches the browser.
import type { BillPreview, VoiceBillResult } from "@/lib/api.ts";
import type { ItemInput, SaveResult } from "@/lib/billing.ts";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import type { FollowUp } from "@/lib/voice.ts";

export type BillBody = { customerId: number; items: ItemInput[]; cash: number; upi: number };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `request failed: ${res.status}`);
  return data as T;
}

function post(body: unknown, signal?: AbortSignal): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal };
}

export const searchCustomers = (q: string) => call<CustomerMatch>(`/api/customers?q=${encodeURIComponent(q)}`);
export const addCustomer = (name: string) => call<Customer>("/api/customers", post({ name }));
export const fetchPreview = (body: BillBody, signal: AbortSignal) =>
  call<BillPreview>("/api/bills/preview", post(body, signal));
export const confirmBill = (body: BillBody & { draftId: string; allowOverLimit: boolean }) =>
  call<SaveResult>("/api/bills", post(body));
export const interpretBill = (words: string, entries: Omit<BillBody, "customerId">, needsCustomer: boolean, followUp: FollowUp | null, signal: AbortSignal) =>
  call<VoiceBillResult>("/api/bills/voice", post({ words, ...entries, needsCustomer, followUp }, signal));

// Server messages are for developers; the trader gets a plain Hinglish line.
const FRIENDLY: [RegExp, string][] = [
  [/bad qty/, "Har line mein kitne piece, woh likho."],
  [/bad rate/, "Rate sahi likho."],
  [/already exists/, "Is naam ka customer pehle se hai."],
  [/failed to fetch|networkerror/i, "Server se baat nahi ho pa rahi. App chal raha hai, check karo."],
];

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return FRIENDLY.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

// "12" -> 12. Empty, decimals or letters -> null.
export function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text) : null;
}
