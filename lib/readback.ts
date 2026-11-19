// What Bolo says before saving. Wording follows the data sheet. Zero parts are skipped.
import { formatRupees as r } from "./money.ts";
import type { CreditStatus } from "./billing.ts";

export type ReadBackInput = {
  customerName: string;
  total: number;
  cash: number;
  upi: number;
  udhaar: number;
  newOutstanding: number;
  credit: CreditStatus;
  overBy: number;
};

// "₹4,000 cash receive hua aur ₹21,000 udhaar mein gaya."
function paymentSentence(p: ReadBackInput): string {
  const paid = [p.cash && `${r(p.cash)} cash`, p.upi && `${r(p.upi)} UPI`].filter(Boolean).join(" aur ");
  if (!paid) return `Poora ${r(p.udhaar)} udhaar mein gaya.`;
  if (p.udhaar === 0) return `${paid} receive hua.`;
  return `${paid} receive hua aur ${r(p.udhaar)} udhaar mein gaya.`;
}

// "Manat ka total udhaar ab ₹33,500 hai." or the advance left over.
function balanceSentence(p: ReadBackInput): string {
  if (p.newOutstanding < 0) return `${p.customerName} ka ${r(-p.newOutstanding)} advance jama hai.`;
  return `${p.customerName} ka total udhaar ab ${r(p.newOutstanding)} hai.`;
}

export function readBackText(p: ReadBackInput): string {
  const parts = [`${p.customerName} ka bill ${r(p.total)} hua.`, paymentSentence(p), balanceSentence(p)];
  if (p.credit === "near") parts.push("Limit ke paas hai.");
  if (p.credit === "over") parts.push(`Limit se ${r(p.overBy)} upar hai. Phir bhi kaat doon?`);
  else parts.push("Bill kaat doon?");
  return parts.join(" ");
}
