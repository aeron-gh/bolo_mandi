import Link from "next/link";
import { PhoneMockup } from "./_site/phone-mockup.tsx";
import { SiteFooter } from "./_site/site-footer.tsx";
import { SiteHeader } from "./_site/site-header.tsx";
import { SiteIcon, type SiteIconName } from "./_site/site-icons.tsx";

const STEPS = [
  { title: "Speak", text: "Hold the mic and say the customer's name, how many pieces, which grade, and how much came in cash or UPI." },
  { title: "Bolo reads it back", text: "It reads out the total, cash, UPI, credit and the new balance in Hindi, while the bill builds on screen." },
  { title: "Say yes to save", text: "The bill is saved only after you say yes. Even a double tap makes just one bill." },
];

// Commands the voice parser handles today (from the README).
const EXAMPLES = [
  { say: "Manat ko 10 piece grade 1 aur 5 grade 2, 4 hazaar cash.", note: "The whole bill at once." },
  { say: "Vikas ko das piece.", note: "Forgot the grade? Bolo asks which one." },
  { say: "Grade 2 nahi, grade 1 kar.", note: "Fix a mistake just by saying it." },
  { say: "Haan, kaat do.", note: "Save after hearing the read-back." },
  { say: "Vikas ka hisaab batao.", note: "Credit and limit, without leaving the bill." },
  { say: "Aaj kitni sale hui?", note: "Today's bill total, in India time." },
];

const GROUPS: { label: string; items: { icon: SiteIconName; title: string; text: string }[] }[] = [
  {
    label: "Speaking",
    items: [
      { icon: "chat", title: "Hindi and Hinglish", text: "Just as you talk at the counter. 'Do number' works for grade 2 too." },
      { icon: "undo", title: "Fix it by voice", text: "Wrong grade, pieces or payment? Just say what to change." },
      { icon: "chart", title: "Ask about accounts", text: "Anyone's credit, today's sales, or who owes the most." },
    ],
  },
  {
    label: "Accounts",
    items: [
      { icon: "rupee", title: "Credit and limits", text: "Whatever isn't paid in cash or UPI goes on credit. Bolo warns you when a customer is near or over the limit." },
      { icon: "check", title: "One bill, once", text: "Every bill has its own ID, so a mistake can never make two bills." },
      { icon: "speaker", title: "Read-back in Hindi", text: "Before saving, Bolo reads out the whole bill, and 'Play again' repeats it." },
    ],
  },
  {
    label: "Trust",
    items: [
      { icon: "shield", title: "Nothing without your yes", text: "No bill is saved and no ledger changes without your yes." },
      { icon: "users", title: "Unsure of a name? It asks", text: "Three Afzals? Bolo asks which one instead of guessing." },
      { icon: "pen", title: "Type when it's noisy", text: "When it's loud, add items by hand. Voice and touch work on the same bill." },
    ],
  },
];

export default function BoloHome() {
  return (
    <>
      <SiteHeader current="bolo" />
      <main className="flex-1">
        <section className="site-inner grid grid-cols-1 items-center gap-12 pb-16 pt-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pt-16">
          <div>
            <p className="eyebrow">MandiPlus Bolo</p>
            <h1 className="display display-xl mt-5">
              Just speak.
              <span className="hindi-line block">Your bill is ready.</span>
            </h1>
            <p className="lead mt-6">
              Speak at the counter. Bolo makes the bill, splits cash and UPI, and puts the rest on the
              customer&apos;s credit. Nothing is saved until you say yes.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Open Bolo</Link>
              <Link href="/help" className="btn btn-outline">How it works</Link>
              <a href="#examples" className="btn btn-soft sm:col-span-2">Try saying it</a>
            </div>
          </div>
          <div className="flex justify-center md:justify-end"><PhoneMockup /></div>
        </section>

        <section className="site-section on-paper" aria-labelledby="steps-title">
          <div className="site-inner">
            <p className="eyebrow">How it works</p>
            <h2 id="steps-title" className="display display-lg mt-4">Three steps. One bill.</h2>
            <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="step-number">{i + 1}</span>
                  <h3 className="display display-md mt-4">{step.title}</h3>
                  <p className="mt-2 text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="examples" className="site-section" aria-labelledby="examples-title">
          <div className="site-inner">
            <p className="eyebrow">Try saying</p>
            <h2 id="examples-title" className="display display-lg mt-4">Say it like this.</h2>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {EXAMPLES.map((example) => (
                <li key={example.say} className="say-card">
                  <p>&ldquo;{example.say}&rdquo;</p>
                  <small>{example.note}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="site-section on-paper" aria-labelledby="built-title">
          <div className="site-inner">
            <p className="eyebrow">Made for the mandi</p>
            <h2 id="built-title" className="display display-lg mt-4">Built for the rush at the counter.</h2>
            <div className="columns mt-10">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="eyebrow">{group.label}</p>
                  {group.items.map((item) => (
                    <div key={item.title} className="feature">
                      <SiteIcon name={item.icon} />
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="start-title">
          <div className="site-inner flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <h2 id="start-title" className="display display-lg">Speak your next bill.</h2>
            <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Open Bolo</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
