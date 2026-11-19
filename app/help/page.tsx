import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../_site/site-footer.tsx";
import { SiteHeader } from "../_site/site-header.tsx";
import { SiteIcon } from "../_site/site-icons.tsx";

export const metadata: Metadata = { title: "Bolo Help" };

// Every command here is covered by tests/voice.test.ts, tests/voice-ledger.test.ts or the README's tried examples.
const COMMANDS = [
  {
    group: "Making a bill",
    lines: [
      ["Manat ko 10 piece grade 1 aur 5 grade 2, 4 hazaar cash.", "Name, items, grade and payment in one go."],
      ["Vikas ko das piece.", "Grade later: Bolo asks, and you say \"do number\"."],
    ],
  },
  {
    group: "Payment",
    lines: [
      ["10 hazaar cash, UPI se 20 hazaar aaya.", "Cash and UPI separately. The rest goes on credit automatically."],
      ["Das hazaar cash.", "When Bolo asks how much was paid, just say the amount."],
    ],
  },
  {
    group: "Payments received and promises",
    lines: [
      ["Manat ne 5000 cash diye.", "Bolo tells you the new credit and asks \"Shall I record it?\". Say yes to save it to the ledger."],
      ["Manat ki 5000 vasooli.", "Saying \"vasooli\" records a payment even while a bill is open."],
      ["Rahul parso 25 hazaar dega.", "Records a promise with its date. The credit stays the same until the money comes."],
    ],
  },
  {
    group: "Corrections and cancel",
    lines: [
      ["Grade 2 nahi, grade 1 kar.", "Change a wrong grade by saying it."],
      ["Bill cancel karo.", "Cancel the whole bill before it is saved."],
    ],
  },
  {
    group: "Questions",
    lines: [
      ["Vikas ka hisaab batao.", "Credit and limit. The current bill stays as it is."],
      ["Aaj kitni sale hui?", "Total of the bills saved today."],
      ["Sabse zyada udhaar kiska hai?", "Who owes the most."],
    ],
  },
] as const;

const QUESTIONS = [
  ["The mic isn't working?", "Open Bolo in Chrome and allow the microphone. On a phone or tablet, open Bolo from an https address: browsers block the mic on plain http."],
  ["Two customers with the same name?", "Bolo never guesses. It asks which one; say the full name or pick from the list."],
  ["How do I add a new customer?", "Type the name in Choose customer. If it's not in the list, tap \"Yes, add\". A new customer starts with a ₹0 credit limit, so Bolo asks before their first credit bill."],
  ["What if a payment or promise is recorded by mistake?", "Bolo reads it back first and saves only after your yes. Say \"nahi\" and nothing is saved. To fix a saved entry, add a Correction in the ledger; old lines are never deleted."],
  ["When is a bill saved?", "Bolo reads out the whole bill first. It is saved only after you say \"haan, kaat do\" or tap the button. Even a double tap makes just one bill."],
  ["What if the internet or speech service fails?", "If the browser's speech service fails, Bolo transcribes the same recording on your device. The first time downloads about 120 MB, so it needs internet once."],
  ["Too noisy to speak?", "Tap Add items and enter items and payment by hand. Voice and touch work on the same bill."],
] as const;

export default function HelpPage() {
  return (
    <>
      <SiteHeader current="help" />
      <main className="flex-1">
        <section className="site-inner pb-12 pt-10 md:pt-16">
          <p className="eyebrow">Bolo Help</p>
          <h1 className="display display-xl mt-5">How to talk to Bolo.</h1>
          <p className="lead mt-6">Hold the mic, speak, let go. Bolo makes the bill, reads it back, and waits for your yes.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Open Bolo</Link>
            <a href="#questions" className="btn btn-outline">Common questions</a>
          </div>
        </section>

        <section className="site-section on-paper" aria-labelledby="commands-title">
          <div className="site-inner">
            <p className="eyebrow">What you can say</p>
            <h2 id="commands-title" className="display display-lg mt-4">Say it like this.</h2>
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
            <p className="eyebrow">Common questions</p>
            <h2 id="questions-title" className="display display-lg mt-4">What people ask.</h2>
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
