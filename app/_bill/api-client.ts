// Browser calls to our API routes. Type-only imports, so no server code reaches the browser.
import type { BillPreview, VoiceBillResult } from "@/lib/api.ts";
import type { ItemInput, SaveResult } from "@/lib/billing.ts";
import type { Customer, CustomerMatch } from "@/lib/customers.ts";
import type { PaymentResult, PromiseResult } from "@/lib/ledger.ts";
import type { FollowUp } from "@/lib/voice.ts";

export type BillBody = { customerId: number; items: ItemInput[]; cash: number; upi: number };

// A login that ran out sends the owner back to the login page.
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (res.status === 401 && data.error === "login_required") window.location.replace("/login");
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
export const recordVasooli = (body: { draftId: string; customerId: number; amount: number; mode: "cash" | "upi" | null; allowAdvance: boolean }) =>
  call<PaymentResult>("/api/payments", post(body));
export const recordVaada = (body: { draftId: string; customerId: number; amount: number; due: string }) =>
  call<PromiseResult>("/api/promises", post(body));
export const interpretBill = (words: string, entries: Omit<BillBody, "customerId">, customerId: number | null, followUp: FollowUp | null, accountQuestion: boolean, signal: AbortSignal) =>
  call<VoiceBillResult>("/api/bills/voice", post({ words, ...entries, customerId, needsCustomer: customerId === null, followUp, accountQuestion }, signal));

// Server messages are for developers; the trader gets a plain English line.
const FRIENDLY: [RegExp, string][] = [
  [/bad qty/, "Enter how many pieces for each line."],
  [/bad rate/, "Please enter a valid rate."],
  [/already exists/, "A customer with this name already exists."],
  [/login_required/, "Your login has ended. Please log in again."],
  [/failed to fetch|networkerror/i, "Can't reach the server. Check that Bolo is running, then try again."],
];

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return FRIENDLY.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

// "12" -> 12. Empty, decimals or letters -> null.
export function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text) : null;
}
