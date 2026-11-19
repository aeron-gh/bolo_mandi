// Interpret one finalized mic turn. The caller owns the draft and confirmation.
import { calculateBill, type Grade, type ItemInput, type RateCard, type Unit } from "./billing.ts";
import { rs } from "./money.ts";
import { clearSpeech } from "./voice-text.ts";

export type BillEntries = { items: ItemInput[]; cash: number; upi: number };
export type FollowUp =
  | { kind: "grade"; qty: number; unit: Unit }
  | { kind: "payment"; mode?: "cash" | "upi" };
export type VoiceTurn =
  | { kind: "confirm"; assentOnly?: true }
  | { kind: "review" | "cancel" }
  | { kind: "question"; query: "khata"; name?: string }
  | { kind: "question"; query: "sales" | "salesScope" | "topDebt" }
  | { kind: "repeat"; reason: "unclear" | "payment" | "line" }
  | { kind: "edit"; name?: string; entries: BillEntries; followUp?: FollowUp | null };

const WORDS: Record<string, string> = Object.create(null);
for (const group of [
  "grade gred ग्रेड", "number numbar नंबर नम्बर", "piece pieces पीस", "crate crates क्रेट",
  "ko को", "ke के", "liye लिए लिये", "ka का", "ki की", "wala वाला", "wale वाले",
  "bill बिल", "maal माल", "rate रेट भाव", "rupaye रुपये रुपए rupees", "cash कैश नकद",
  "upi यूपीआई", "payment पेमेंट भुगतान", "full poora pura poori पूरा पूरी", "aadha adha आधा",
  "baaki baki बाकी", "udhaar udhar उधार", "khate खाते", "mein me में", "se से",
  "aaya aya आया", "aaye आए", "diya दिया", "diye दिए", "hai है", "hain हैं", "de दे", "dena देना",
  "do दो", "kar karo करो कर", "laga lagaao lagao लगा लगाओ", "likh लिख", "likho लिखो", "aur and और",
  "kaat kat काट", "haan han हां हाँ", "pata पता", "phir फिर", "bhi भी",
  "nahi nahin नहीं", "arre are अरे", "ruk रुको रुक", "hata हटा", "badal बदल",
  "cancel कैंसल कैंसिल रद्द", "rehne रहने", "banao बनाओ", "padho पढ़ो पढ़ो",
  "kuch कुछ", "paise पैसे", "baad बाद", "hazaar hazar hajar hajaar हजार हज़ार",
  "aaj आज", "kitni कितनी", "kitna कितना", "sale sales सेल सेल्स बिक्री बिकरी bikri", "hui हुई हुयी हुईं huyi",
  "hisaab hisab हिसाब", "bata batao बताओ बता बताइए", "limit लिमिट सीमा",
  "iska इसका", "inka इनका", "sabse सबसे", "zyada zyadaa jyada ज्यादा ज़्यादा", "kiska किसका",
  "lakh lac लाख", "sau सौ", "dedh डेढ़ डेढ़", "dhai ढाई", "saadhe sadhe साढ़े साढ़े",
  "1 ek one एक", "2 two", "3 teen three तीन", "4 char chaar four चार",
  "5 panch paanch five पांच पाँच", "6 che chhe six छह छः", "7 saat seven सात", "8 aath eight आठ",
  "9 nau nine नौ", "10 das ten दस", "11 gyarah ग्यारह", "12 barah twelve बारह",
  "13 terah तेरह", "14 chaudah चौदह", "15 pandrah पंद्रह पन्द्रह", "16 solah सोलह",
  "17 satrah सत्रह", "18 atharah अठारह", "19 unnees उन्नीस", "20 bees twenty बीस",
  "21 ikkees इक्कीस", "22 bais बाईस", "23 teis तेईस", "24 chaubees चौबीस",
  "25 pachees pacchis pachis twenty-five पच्चीस", "26 chhabees छब्बीस", "27 sattais सत्ताईस",
  "28 atthais अट्ठाईस", "29 untees उनतीस", "30 tees thirty तीस",
  "31 इकतीस", "32 बत्तीस", "33 तैंतीस", "34 चौंतीस", "35 paintees पैंतीस",
  "36 छत्तीस", "37 सैंतीस", "38 अड़तीस", "39 उनतालीस",
  "40 chalees chalis forty चालीस", "41 इकतालीस", "42 बयालीस", "43 तैंतालीस", "44 चवालीस",
  "45 paintalees पैंतालीस", "46 छियालीस", "47 सैंतालीस", "48 अड़तालीस", "49 उनचास",
  "50 pachas pachaas fifty पचास", "51 इक्यावन", "52 बावन", "53 तिरपन", "54 चौवन",
  "55 पचपन", "56 छप्पन", "57 सत्तावन", "58 अट्ठावन", "59 उनसठ",
  "60 saath sixty साठ", "61 इकसठ", "62 बासठ", "63 तिरसठ", "64 चौंसठ",
  "65 पैंसठ", "66 छियासठ", "67 सड़सठ", "68 अड़सठ", "69 उनहत्तर",
  "70 sattar seventy सत्तर", "71 इकहत्तर", "72 बहत्तर", "73 तिहत्तर", "74 चौहत्तर",
  "75 pachhattar पचहत्तर", "76 छिहत्तर", "77 सतहत्तर", "78 अठहत्तर", "79 उनासी",
  "80 assi eighty अस्सी", "81 इक्यासी", "82 बयासी", "83 तिरासी", "84 चौरासी",
  "85 पचासी", "86 छियासी", "87 सत्तासी", "88 अट्ठासी", "89 नवासी",
  "90 nabbe ninety नब्बे", "91 इक्यानवे", "92 बानवे", "93 तिरानवे", "94 चौरानवे",
  "95 पंचानवे", "96 छियानवे", "97 सत्तानवे", "98 अट्ठानवे", "99 निन्यानवे",
]) {
  const [canonical, ...variants] = group.split(" ");
  for (const variant of variants) WORDS[variant.normalize("NFC")] = canonical;
}

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase()
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/(?<=\d),(?=\d{2,3}(?:\D|$))/g, "")
    .replace(/[।.!?:;…]+/g, ",")
    .replace(/₹/g, "")
    .replace(/[\s,]+/g, (separator) => separator.includes(",") ? " , " : " ")
    .replace(/^[ ,]+|[ ,]+$/g, "")
    .split(" ")
    .map((word) => WORDS[word] ?? word)
    .join(" ")
    .replace(/\bu p i\b/g, "upi")
    .replace(/(?:^| )यू पी आई(?= |$)/g, " upi")
    .trim();
}

function whole(value: string): number | null {
  if (value === "do") return 2;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function quantity(text: string): number | null {
  let remaining = text.trim();
  let total = 0;
  for (const [word, scale] of [["lakh", 100000], ["hazaar", 1000], ["sau", 100]] as const) {
    const match = remaining.match(new RegExp(`^(.*?)\\b${word}(?: |$)`));
    if (!match) continue;
    const multiplier = match[1].trim();
    const wholePart = multiplier.match(/^saadhe (.+)$/);
    const n = wholePart ? whole(wholePart[1]) : whole(multiplier || "1");
    if (multiplier === "dedh") total += scale * 3 / 2;
    else if (multiplier === "dhai") total += scale * 5 / 2;
    else if (n !== null) total += n * scale + (wholePart ? scale / 2 : 0);
    else return null;
    remaining = remaining.slice(match[0].length);
  }
  const extra = whole(remaining || "0");
  if (extra === null || !Number.isSafeInteger(total + extra)) return null;
  return total + extra;
}

const GRADE = "([123abc]|do)";
const GRADE_LABEL = `(?:grade ${GRADE}|${GRADE} (?:grade|number)(?: (?:wala|wale|ka|ki))?)`;
function gradeOf(value: string): Grade {
  return value === "1" || value === "a" ? 1 : value === "3" || value === "c" ? 3 : 2;
}

function itemFrom(text: string): ItemInput | null {
  const before = text.match(new RegExp(`^(.+?)(?: (piece|crate))? ${GRADE_LABEL}(?: (piece|crate))?$`));
  const after = text.match(new RegExp(`^${GRADE_LABEL} (.+?)(?: (piece|crate))?$`));
  const qty = before ? quantity(before[1]) : after ? quantity(after[3]) : null;
  if (!qty || (!before && !after)) return null;
  const grade = gradeOf(before ? before[3] ?? before[4] : after![1] ?? after![2]);
  const unit = (before ? before[2] ?? before[5] : after![4]) as Unit | undefined;
  return unit ? { grade, qty, unit } : { grade, qty };
}

function paise(text: string): number | null {
  const amount = quantity(text.replace(/ rupaye$/, ""));
  return amount === null || amount > Math.floor(Number.MAX_SAFE_INTEGER / 100) ? null : rs(amount);
}

type Payment = { mode: "cash" | "upi"; amount: number | "half" | "full" };

function paymentFrom(text: string): Payment | null {
  const before = text.match(/^(full|aadha|.+?) (cash|upi)(?: (?:mein|se))?$/);
  const after = text.match(/^(cash|upi)(?: (?:mein|se))? (full|aadha|.+)$/);
  if (!before && !after) return null;
  const amount = before ? before[1] : after![2];
  const value = amount === "full" ? "full" : amount === "aadha" ? "half" : paise(amount);
  if (value === null) return null;
  return { mode: (before?.[2] ?? after![1]) as Payment["mode"], amount: value };
}

function cleanClause(clause: string): string {
  return clause
    .replace(/ (?:baaki|aadha) (?:udhaar(?: likh (?:de|do|dena)| likho)?|khate mein)$/, "")
    .replace(/(?: (?:de do|de dena|diya hai|diye hain|diya|diye|aaya hai|aaya|aaye|laga de|laga do|laga|kar do|kar))+$/, "");
}

function splitSpokenClause(clause: string): string[] {
  // A transcriber can omit punctuation between a complete item and a payment.
  for (const boundary of clause.matchAll(/ /g)) {
    const left = clause.slice(0, boundary.index);
    const right = clause.slice(boundary.index + 1);
    if (itemFrom(cleanClause(left)) && paymentFrom(cleanClause(right))) return [left, right];
  }
  return [clause];
}

// Resolve relative payments only after all item and rate edits have been applied.
function applyPayments(entries: BillEntries, payments: Payment[], total: number): boolean {
  if (payments.some(({ amount }) => typeof amount !== "number")) {
    if (entries.items.length === 0 || payments.filter(({ amount }) => amount === "full").length > 1) return false;
    entries.cash = entries.upi = 0;
  }
  for (const { mode, amount } of payments) {
    if (typeof amount === "number") entries[mode] = amount;
    else entries[mode] = amount === "full" ? total : Math.floor(total / 2);
  }
  return true;
}

// Match complete report questions so an individual customer's sale or another
// day's sale is never answered with the shop-wide total for today.
function isDailySales(text: string): boolean {
  const request = text.trim().toLowerCase()
    .replace(/^please\s+/, "")
    .replace(/^(?:what(?:['’]s| is| are| was| were)|show(?: me)?|tell me|give me) (?:the |my |our )?/, "")
    .replace(/\b(?:today['’]s|todays|today)\b|टुडे(?:ज़)?/gu, "aaj");
  const question = normalize(request).replace(/ , /g, " ")
    .replace(/^(?:arre |bolo |bata |mujhe |मुझे )+/, "")
    .replace(/ (?:bata(?: do)?|please)$/, "")
    .replace(/(?:^| )(?:total|टोटल|कुल|kul)(?= )/g, "")
    .trim();
  if (/^aaj (?:ki |ka )?(?:kitni |kitna )?sale(?: (?:kitni|kitna|kya|क्या|kitne ki|कितने ki))?(?: hui)?(?: hai)?$/.test(question)) return true;
  if (/^(?:kitni |kitna )?sale (?:hui )?aaj$/.test(question)) return true;
  return /^how much (?:did (?:we|i) sell|sale|were (?:the |our )?sale) aaj$/.test(question);
}

export function interpretVoice(text: string, current: BillEntries, rates: RateCard, needsCustomer: boolean, pending?: FollowUp, accountQuestion = false): VoiceTurn {
  if (!clearSpeech(text)) return { kind: "repeat", reason: "unclear" };
  let command = normalize(text).replace(/^arre /, "");
  if (/^(?:haan(?: pata hai)?(?: ,? ?(?:phir bhi )?(?:bill )?kaat do)?|(?:bill )?kaat do)$/.test(command)) {
    return command.includes("kaat") ? { kind: "confirm" } : { kind: "confirm", assentOnly: true };
  }
  if (/(?:^| , )(?:rehne do(?: , )?)?(?:bill )?cancel(?: kar| kar do)?$|^rehne do$/.test(command)) {
    return { kind: "cancel" };
  }
  if (/^(?:bill banao|bill padho|dobara padho|phir se padho)$/.test(command)) return { kind: "review" };
  if (/\b(?:sale|sell)\b/.test(command) && isDailySales(text)) return { kind: "question", query: "sales" };
  if (/^sabse zyada udhaar kiska(?: hai)?$/.test(command)) return { kind: "question", query: "topDebt" };
  const namedKhata = command.match(/^([\p{L}\p{M} .'-]+?) (?:ka|ki) (?:(?:hisaab|udhaar|limit)(?: bata| kitna hai)?|kitna udhaar hai)$/u);
  if (namedKhata) return { kind: "question", query: "khata", name: namedKhata[1] };
  if (/^(?:(?:iska|inka) )?(?:hisaab|udhaar|limit)(?: bata| kitna hai)$|^kitna udhaar hai$/.test(command)) {
    return { kind: "question", query: "khata" };
  }

  if (pending?.kind === "grade") {
    const label = command.match(new RegExp(`^${GRADE_LABEL}$`));
    const grade = label?.[1] ?? label?.[2] ?? command.match(/^(?:[123abc]|do)$/)?.[0];
    if (grade) {
      const item = { grade: gradeOf(grade), qty: pending.qty, unit: pending.unit };
      return { kind: "edit", entries: { ...current, items: [...current.items, item] }, followUp: null };
    }
  }
  if (pending?.kind === "payment" && pending.mode) {
    const amount = paise(command);
    if (amount !== null) {
      return { kind: "edit", entries: { ...current, [pending.mode]: amount }, followUp: null };
    }
  }

  command = command
    .replace(/^(?:ruk|nahi(?: nahi)?) (?:, )?/, "")
    .replace(/ , nahi(?: nahi)? , /g, " , ")
    .replace(new RegExp(`^(${GRADE_LABEL} nahi) , `), "$1 ");
  let name: string | undefined;
  const order = command.match(/^([\p{L}\p{M} .'-]+?) (?:ko|ke liye|ka bill)(?: ,)?(?: |$)/u);
  if (order) {
    name = order[1];
    command = command.slice(order[0].length);
  }
  // A correction can replace the customer within the same mic turn.
  const changeName = command.match(/ , (?:arre )?[\p{L}\p{M} .'-]+ nahi , ([\p{L}\p{M} .'-]+) ko$/u);
  if (changeName) {
    name = changeName[1];
    command = command.slice(0, changeName.index);
  }

  const entries: BillEntries = { items: [...current.items], cash: current.cash, upi: current.upi };
  const payments: Payment[] = [];
  const clauses = command.split(/ , | aur /).filter(Boolean).flatMap(splitSpokenClause);
  let followUp: FollowUp | null | undefined;
  let activeLine: number | undefined;
  for (const clause of clauses) {
    const fragment = cleanClause(clause);
    const item = itemFrom(fragment);
    if (item) {
      entries.items.push(item);
      if (pending?.kind === "grade") followUp = null;
      activeLine = entries.items.length - 1;
      continue;
    }
    const payment = paymentFrom(fragment.replace(/^(full) payment /, "$1 "));
    if (payment) {
      payments.push(payment);
      if (pending?.kind === "payment" && (!pending.mode || pending.mode === payment.mode)) followUp = null;
      continue;
    }
    if (/^(?:baaki |aadha )?(?:udhaar(?: likh (?:de|do|dena)| likho)?|khate mein)$/.test(fragment) || fragment === "payment baad mein") continue;
    if (/^(?:kuch paise|payment|cash|upi)(?: (?:cash|upi|mein|se))?$/.test(fragment)) {
      const mode = fragment.match(/\b(cash|upi)\b/)?.[1] as Payment["mode"] | undefined;
      followUp = { kind: "payment", mode };
      continue;
    }
    if (/^(?:kuch paise|payment|cash|upi)\b|\b(?:cash|upi|paise)$/.test(fragment)) return { kind: "repeat", reason: "payment" };

    const rate = fragment.match(/^(?:rate (.+)|iska (.+)|(.+) final)$/);
    const qty = fragment.match(/^(.+?) (piece|crate)(?: badal)?$/);
    const remove = fragment.match(new RegExp(`^${GRADE_LABEL}(?: wala)? hata(?: de| do)?$`));
    const regrade = fragment.match(new RegExp(`^${GRADE_LABEL} nahi ${GRADE_LABEL}$`));
    if (rate || qty || remove || regrade) {
      let index = activeLine ?? (entries.items.length === 1 ? 0 : -1);
      if (remove || regrade) {
        const match = (remove ?? regrade)!;
        const grade = gradeOf(match[1] ?? match[2]);
        const indices = entries.items.flatMap((line, i) => line.grade === grade ? [i] : []);
        if (indices.length !== 1) return { kind: "repeat", reason: "line" };
        index = indices[0];
      }
      const line = entries.items[index];
      if (qty && entries.items.length === 0) {
        const value = quantity(qty[1]);
        if (value) {
          followUp = { kind: "grade", qty: value, unit: qty[2] as Unit };
          continue;
        }
      }
      if (!line) return { kind: "repeat", reason: "line" };
      if (remove) {
        entries.items.splice(index, 1);
        activeLine = undefined;
        continue;
      }
      activeLine = index;
      if (regrade) entries.items[index] = { ...line, grade: gradeOf(regrade[3] ?? regrade[4]) };
      if (rate) {
        const value = paise(rate[1] ?? rate[2] ?? rate[3]);
        if (!value) return { kind: "repeat", reason: "unclear" };
        entries.items[index] = { ...line, rate: value };
      }
      if (qty) {
        const value = quantity(qty[1]);
        if (!value) return { kind: "repeat", reason: "unclear" };
        entries.items[index] = { ...line, qty: value, unit: qty[2] as Unit };
      }
      continue;
    }

    if (/\bsale\b/.test(fragment)) return { kind: "question", query: "salesScope" };
    if ((needsCustomer || accountQuestion) && !name && clauses.length === 1 && /^[\p{L}\p{M}'-]+(?: [\p{L}\p{M}'-]+){0,3}$/u.test(fragment)
      && !/\b(?:grade|number|piece|crate|bill|udhaar|ka|ko|kar|print|whatsapp|hisaab)\b/.test(fragment)) {
      if (accountQuestion) return { kind: "question", query: "khata", name: fragment };
      name = fragment;
      continue;
    }
    return { kind: "repeat", reason: "unclear" };
  }

  if (!name && clauses.length === 0) return { kind: "repeat", reason: "unclear" };
  const { total } = calculateBill(entries.items, rates);
  if (!applyPayments(entries, payments, total)) return { kind: "repeat", reason: "payment" };
  return { kind: "edit", name, entries, followUp };
}
