import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../_site/site-footer.tsx";
import { SiteHeader } from "../_site/site-header.tsx";
import { SiteIcon } from "../_site/site-icons.tsx";

export const metadata: Metadata = { title: "Bolo Help" };

// Every command here is covered by tests/voice.test.ts or the README's tried examples.
const COMMANDS = [
  {
    group: "Bill banana",
    lines: [
      ["Manat ko 10 piece grade 1 aur 5 grade 2, 4 hazaar cash.", "Naam, maal, grade aur payment ek saath."],
      ["Vikas ko das piece.", "Grade baad mein: Bolo poochhega, aap kahiye 'do number'."],
    ],
  },
  {
    group: "Payment",
    lines: [
      ["10 hazaar cash, UPI se 20 hazaar aaya.", "Cash aur UPI alag alag. Baaki apne aap udhaar."],
      ["Das hazaar cash.", "Bolo ne poochha kitna mila, to sirf rakam boliye."],
    ],
  },
  {
    group: "Sudhaar aur cancel",
    lines: [
      ["Grade 2 nahi, grade 1 kar.", "Galat grade bolke badliye."],
      ["Bill cancel karo.", "Bill katne se pehle poora bill hata dijiye."],
    ],
  },
  {
    group: "Sawaal",
    lines: [
      ["Vikas ka hisaab batao.", "Udhaar aur limit. Chal raha bill waisa hi rehta hai."],
      ["Aaj kitni sale hui?", "Aaj ke kate hue bills ka total."],
      ["Sabse zyada udhaar kiska hai?", "Sabse bada khata kiska hai."],
    ],
  },
] as const;

const QUESTIONS = [
  ["Mic kaam nahi kar raha?", "Chrome mein Bolo kholiye aur mic ki permission dijiye. Phone ya tablet par Bolo https wale address se kholiye: browser http par mic band rakhta hai."],
  ["Ek naam ke do log hain?", "Bolo andaaze se nahi chunta. Woh poochhega kaunsa, aap poora naam boliye ya list se chuniye."],
  ["Naya customer kaise jodein?", "Customer chuno mein naam likhiye. List mein na ho to 'add karo' dabaiye. Naye customer ki limit ₹0 se shuru hoti hai, isliye pehle udhaar par Bolo poochhega."],
  ["Bill kab katta hai?", "Bolo pehle poora hisaab sunata hai. 'Haan, kaat do' bolne ya button dabane ke baad hi bill katta hai. Button do baar dab jaaye, tab bhi bill ek hi banega."],
  ["Internet ya speech service band ho jaaye?", "Browser ki speech service fail ho to Bolo usi recording ko aapke device par hi likhne ki koshish karta hai. Iske liye pehli baar lagbhag 120 MB download hota hai, isliye pehli baar internet chahiye."],
  ["Shor bahut hai, bolna mushkil hai?", "Likho kholiye aur haath se maal aur payment bhariye. Bolo aur Likho ek hi bill par kaam karte hain."],
] as const;

export default function HelpPage() {
  return (
    <>
      <SiteHeader current="help" />
      <main className="flex-1">
        <section className="site-inner pb-12 pt-10 md:pt-16">
          <p className="eyebrow">Bolo Help</p>
          <h1 className="display display-xl mt-5">Bolo se kaise baat karein.</h1>
          <p className="lead mt-6">Mic dabaiye, boliye, chhodiye. Bolo bill banata hai, padhke sunata hai, aur aapki haan ka intezaar karta hai.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Bolo kholo</Link>
            <a href="#questions" className="btn btn-outline">Aam sawaal</a>
          </div>
        </section>

        <section className="site-section on-paper" aria-labelledby="commands-title">
          <div className="site-inner">
            <p className="eyebrow">Kya bol sakte hain</p>
            <h2 id="commands-title" className="display display-lg mt-4">Aise boliye.</h2>
            <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2">
              {COMMANDS.map(({ group, lines }) => (
                <div key={group}>
                  <h3 className="display display-md">{group}</h3>
                  <ul className="mt-4 grid gap-3">
                    {lines.map(([say, note]) => (
                      <li key={say} className="say-card">
                        <p>&ldquo;{say}&rdquo;</p>
                        <small>{note}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="questions" className="site-section" aria-labelledby="questions-title">
          <div className="site-inner">
            <p className="eyebrow">Aam sawaal</p>
            <h2 id="questions-title" className="display display-lg mt-4">Jo log poochhte hain.</h2>
            <div className="mt-10 max-w-3xl border-t border-line">
              {QUESTIONS.map(([question, answer]) => (
                <details key={question} className="group border-b border-line py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold">
                    {question}
                    <span aria-hidden className="text-2xl text-coconut group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
