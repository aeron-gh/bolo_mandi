// What Bolo says around vasooli and vaada: polite Hinglish on screen, Hindi for the voice.
// Every question says what Bolo understood and what will change, then waits for "haan".
import { shortDay } from "./dates.ts";
import { formatRupees as r } from "./money.ts";

export type Say = { text: string; speech: string };
type Mode = "cash" | "upi" | null;
type When = "aaj" | "kal" | "parso";

const spoken = (paise: number) => `${r(paise).slice(1)} रुपये`;
const MODE_TEXT = { cash: "cash", upi: "UPI" } as const;
const MODE_SPEECH = { cash: "कैश", upi: "यूपीआई" } as const;
const WHEN_SPEECH: Record<When, string> = { aaj: "आज", kal: "कल", parso: "परसों" };

// "afzal khan" -> "Afzal Khan", for names Bolo repeats back.
const title = (name: string) => name.replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

// ["A", "B", "C"] -> "A, B ya C"
export function orList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ya ${items.at(-1)}`;
}

export function paymentQuestion(p: { name: string; amount: number; mode: Mode; before: number; after: number }): Say {
  const how = p.mode ? ` ${MODE_TEXT[p.mode]}` : "";
  return {
    text: `${p.name} se ${r(p.amount)}${how} mile${p.mode ? "" : ", cash ya UPI nahi bataya"}. Udhaar ${r(p.before)} se ${r(p.after)} ho jayega. Likh doon?`,
    speech: `${p.name} से ${spoken(p.amount)}${p.mode ? ` ${MODE_SPEECH[p.mode]}` : ""} मिले। उधार ${spoken(p.after)} हो जाएगा। लिख दूँ?`,
  };
}

// More than is owed: ask before keeping the extra as advance.
export function advanceQuestion(p: { name: string; before: number; extra: number }): Say {
  const owed = Math.max(0, p.before);
  return {
    text: `${p.name} ka udhaar ${r(owed)} hai, yeh ${r(p.extra)} zyada hai. Zyada wala advance mein rakh doon?`,
    speech: `${p.name} का उधार ${spoken(owed)} है, यह ${spoken(p.extra)} ज़्यादा है। ज़्यादा वाला एडवांस में रख दूँ?`,
  };
}

export function paymentDone(p: { name: string; after: number }): Say {
  if (p.after === 0) return { text: `Likh liya. ${p.name} ka hisaab barabar ho gaya.`, speech: `लिख लिया। ${p.name} का हिसाब बराबर हो गया।` };
  if (p.after < 0) return { text: `Likh liya. ${p.name} ka ${r(-p.after)} advance jama hai.`, speech: `लिख लिया। ${p.name} का ${spoken(-p.after)} एडवांस जमा है।` };
  return { text: `Likh liya. ${p.name} ka udhaar ab ${r(p.after)} hai.`, speech: `लिख लिया। ${p.name} का उधार अब ${spoken(p.after)} है।` };
}

export function promiseQuestion(p: { name: string; amount: number; dueWord: When; dueDate: string }): Say {
  return {
    text: `${p.name} ${r(p.amount)} ${p.dueWord}, ${shortDay(p.dueDate)} tak dega. Vaada likh doon?`,
    speech: `${p.name} ${spoken(p.amount)} ${WHEN_SPEECH[p.dueWord]} तक देगा। वादा लिख दूँ?`,
  };
}

// A promise never changes the udhaar, so Bolo offers to note the money when it comes.
export function promiseDone(): Say {
  return { text: "Vaada likh liya. Paise aayen to bata dena, vasooli likh dunga.", speech: "वादा लिख लिया। पैसे आएँ तो बता देना, वसूली लिख दूँगा।" };
}

export function askPaymentAmount(name: string): Say {
  return {
    text: `${name} ne kitne rupaye diye? Poori baat ek saath boliye, jaise “${name} ne 5000 cash diye”.`,
    speech: `${name} ने कितने रुपये दिए? पूरी बात एक साथ बोलिए।`,
  };
}

export function askPromiseAmount(name: string): Say {
  return {
    text: `${name} kitne rupaye dega? Poori baat ek saath boliye, jaise “${name} kal 5000 dega”.`,
    speech: `${name} कितने रुपये देगा? पूरी बात एक साथ बोलिए।`,
  };
}

export function askDue(name: string): Say {
  return {
    text: `${name} kab tak dega, aaj, kal ya parso? Poori baat phir se boliye.`,
    speech: `${name} कब तक देगा, आज, कल या परसों? पूरी बात फिर से बोलिए।`,
  };
}

export function whoIsIt(heard: string, options: string[]): Say {
  return {
    text: `Kaun se ${title(heard)}? ${orList(options)}. Poora naam boliye.`,
    speech: `कौन से ${heard}? पूरा नाम बोलिए।`,
  };
}

export function notFound(heard: string): Say {
  return {
    text: `“${title(heard)}” naam ka koi customer nahi mila. Naam ek baar phir boliye.`,
    speech: "इस नाम का कोई ग्राहक नहीं मिला। नाम एक बार फिर बोलिए।",
  };
}

export const DROPPED: Say = { text: "Theek hai, kuch nahi likha.", speech: "ठीक है, कुछ नहीं लिखा।" };
