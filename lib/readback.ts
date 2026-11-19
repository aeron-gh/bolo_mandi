// What Bolo shows before saving (English), and the Hindi it speaks. Zero parts are skipped.
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

// "₹4,000 cash received, ₹21,000 goes on credit."
function paymentSentence(p: ReadBackInput): string {
  const paid = [p.cash && `${r(p.cash)} cash`, p.upi && `${r(p.upi)} UPI`].filter(Boolean).join(" and ");
  if (!paid) return `All ${r(p.udhaar)} goes on credit.`;
  if (p.udhaar === 0) return `${paid} received.`;
  return `${paid} received, ${r(p.udhaar)} goes on credit.`;
}

// "Manat's total credit is now ₹33,500." or the advance left over.
function balanceSentence(p: ReadBackInput): string {
  if (p.newOutstanding < 0) return `${p.customerName} has ${r(-p.newOutstanding)} in advance.`;
  return `${p.customerName}'s total credit is now ${r(p.newOutstanding)}.`;
}

export function readBackText(p: ReadBackInput): string {
  const parts = [`${p.customerName}'s bill is ${r(p.total)}.`, paymentSentence(p), balanceSentence(p)];
  if (p.credit === "near") parts.push("Close to the credit limit.");
  if (p.credit === "over") parts.push(`${r(p.overBy)} over the credit limit. Save the bill anyway?`);
  else parts.push("Save the bill?");
  return parts.join(" ");
}

export function hindiReadBack(p: ReadBackInput & { overpaidBy: number }): string {
  const money = (paise: number) => `${r(paise).slice(1)} रुपये`;
  if (p.overpaidBy > 0) return `${money(p.overpaidBy)} ज़्यादा मिले हैं। कैश या यूपीआई की रकम ठीक करें।`;

  const paid = [p.cash && `${money(p.cash)} कैश`, p.upi && `${money(p.upi)} यूपीआई`].filter(Boolean).join(" और ");
  const parts = [`${p.customerName} का बिल ${money(p.total)} हुआ।`];
  if (paid) parts.push(`${paid} मिले।`);
  if (p.udhaar) parts.push(`${money(p.udhaar)} उधार में गए।`);
  parts.push(p.newOutstanding < 0
    ? `अब ${money(-p.newOutstanding)} एडवांस जमा हैं।`
    : `अब कुल उधार ${money(p.newOutstanding)} है।`);
  if (p.credit === "near") parts.push("लिमिट के पास है।");
  if (p.credit === "over") parts.push(`लिमिट से ${money(p.overBy)} ऊपर है। फिर भी बिल काट दूँ?`);
  else parts.push("बिल काट दूँ?");
  return parts.join(" ");
}
