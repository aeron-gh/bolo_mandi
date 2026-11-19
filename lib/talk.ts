// What Bolo says around payments and promises: English on screen, Hindi for the voice.
// Every question says what Bolo understood and what will change, then waits for "haan".
import { shortDay } from "./dates.ts";
import { formatRupees as r } from "./money.ts";

export type Say = { text: string; speech: string };
type Mode = "cash" | "upi" | null;
type When = "aaj" | "kal" | "parso";

const spoken = (paise: number) => `${r(paise).slice(1)} रुपये`;
const MODE_TEXT = { cash: "in cash", upi: "by UPI" } as const;
const WHEN_TEXT: Record<When, string> = { aaj: "today", kal: "tomorrow", parso: "the day after tomorrow" };
const MODE_SPEECH = { cash: "कैश", upi: "यूपीआई" } as const;
const WHEN_SPEECH: Record<When, string> = { aaj: "आज", kal: "कल", parso: "परसों" };

// "afzal khan" -> "Afzal Khan", for names Bolo repeats back.
const title = (name: string) => name.replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

// ["A", "B", "C"] -> "A, B or C"
export function orList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

export function paymentQuestion(p: { name: string; amount: number; mode: Mode; before: number; after: number }): Say {
  const how = p.mode ? ` ${MODE_TEXT[p.mode]}` : "";
  return {
    text: `${p.name} paid ${r(p.amount)}${how}${p.mode ? "" : " (cash or UPI not said)"}. Credit goes from ${r(p.before)} to ${r(p.after)}. Shall I record it?`,
    speech: `${p.name} से ${spoken(p.amount)}${p.mode ? ` ${MODE_SPEECH[p.mode]}` : ""} मिले। उधार ${spoken(p.after)} हो जाएगा। लिख दूँ?`,
  };
}

// More than is owed: ask before keeping the extra as advance.
export function advanceQuestion(p: { name: string; before: number; extra: number }): Say {
  const owed = Math.max(0, p.before);
  return {
    text: `${p.name} owes ${r(owed)}, so this is ${r(p.extra)} more. Keep the extra as advance?`,
    speech: `${p.name} का उधार ${spoken(owed)} है, यह ${spoken(p.extra)} ज़्यादा है। ज़्यादा वाला एडवांस में रख दूँ?`,
  };
}

export function paymentDone(p: { name: string; after: number }): Say {
  if (p.after === 0) return { text: `Recorded. ${p.name}'s account is settled.`, speech: `लिख लिया। ${p.name} का हिसाब बराबर हो गया।` };
  if (p.after < 0) return { text: `Recorded. ${p.name} has ${r(-p.after)} in advance.`, speech: `लिख लिया। ${p.name} का ${spoken(-p.after)} एडवांस जमा है।` };
  return { text: `Recorded. ${p.name}'s credit is now ${r(p.after)}.`, speech: `लिख लिया। ${p.name} का उधार अब ${spoken(p.after)} है।` };
}

export function promiseQuestion(p: { name: string; amount: number; dueWord: When; dueDate: string }): Say {
  return {
    text: `${p.name} will pay ${r(p.amount)} ${WHEN_TEXT[p.dueWord]}, ${shortDay(p.dueDate)}. Record the promise?`,
    speech: `${p.name} ${spoken(p.amount)} ${WHEN_SPEECH[p.dueWord]} तक देगा। वादा लिख दूँ?`,
  };
}

// A promise never changes the udhaar, so Bolo offers to note the money when it comes.
export function promiseDone(): Say {
  return { text: "Promise recorded. Tell me when the money comes and I'll record the payment.", speech: "वादा लिख लिया। पैसे आएँ तो बता देना, वसूली लिख दूँगा।" };
}

export function askPaymentAmount(name: string): Say {
  return {
    text: `How much did ${name} pay? Say it all at once, like “${name} ne 5000 cash diye”.`,
    speech: `${name} ने कितने रुपये दिए? पूरी बात एक साथ बोलिए।`,
  };
}

export function askPromiseAmount(name: string): Say {
  return {
    text: `How much will ${name} pay? Say it all at once, like “${name} kal 5000 dega”.`,
    speech: `${name} कितने रुपये देगा? पूरी बात एक साथ बोलिए।`,
  };
}

export function askDue(name: string): Say {
  return {
    text: `When will ${name} pay: today, tomorrow or the day after? Please say the whole sentence again.`,
    speech: `${name} कब तक देगा, आज, कल या परसों? पूरी बात फिर से बोलिए।`,
  };
}

export function whoIsIt(heard: string, options: string[]): Say {
  return {
    text: `Which ${title(heard)}? ${orList(options)}. Please say the full name.`,
    speech: `कौन से ${heard}? पूरा नाम बोलिए।`,
  };
}

export function notFound(heard: string): Say {
  return {
    text: `No customer called “${title(heard)}”. Please say the name again.`,
    speech: "इस नाम का कोई ग्राहक नहीं मिला। नाम एक बार फिर बोलिए।",
  };
}

export const DROPPED: Say = { text: "Okay, nothing recorded.", speech: "ठीक है, कुछ नहीं लिखा।" };
