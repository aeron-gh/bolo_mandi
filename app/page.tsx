import Link from "next/link";
import { PhoneMockup } from "./_site/phone-mockup.tsx";
import { SiteFooter } from "./_site/site-footer.tsx";
import { SiteHeader } from "./_site/site-header.tsx";
import { SiteIcon, type SiteIconName } from "./_site/site-icons.tsx";

const STEPS = [
  { title: "Bolo", text: "Mic dabake boliye: customer ka naam, kitne piece, kaunsa grade, aur kitna cash ya UPI mila." },
  { title: "Bolo padhke sunata hai", text: "Total, cash, UPI, udhaar aur naya hisaab Hindi mein sunata hai. Screen par bill saath saath banta hai." },
  { title: "Haan, kaat do", text: "Aapki haan ke baad hi bill katta hai. Button do baar dab jaaye, tab bhi bill ek hi banega." },
];

// Commands the voice parser handles today (from the README).
const EXAMPLES = [
  { say: "Manat ko 10 piece grade 1 aur 5 grade 2, 4 hazaar cash.", note: "Poora bill ek baar mein." },
  { say: "Vikas ko das piece.", note: "Grade nahi bola? Bolo poochhega: kaunsa grade?" },
  { say: "Grade 2 nahi, grade 1 kar.", note: "Galti bolke hi sudhaar lijiye." },
  { say: "Haan, kaat do.", note: "Read-back sunne ke baad bill kaatiye." },
  { say: "Vikas ka hisaab batao.", note: "Udhaar aur limit, bill chhode bina." },
  { say: "Aaj kitni sale hui?", note: "Aaj ke bills ka total, India ke time se." },
];

const GROUPS: { label: string; items: { icon: SiteIconName; title: string; text: string }[] }[] = [
  {
    label: "Bolna",
    items: [
      { icon: "chat", title: "Hindi aur Hinglish", text: "Jaise counter par bolte hain, waise hi. Grade ke liye 'do number' bhi chalega." },
      { icon: "undo", title: "Bolke sudhaaro", text: "Grade, piece ya payment galat ho gaya? Bas bol dijiye kya badalna hai." },
      { icon: "chart", title: "Hisaab poochho", text: "Kisi ka udhaar, aaj ki sale, ya sabse zyada udhaar kiska hai." },
    ],
  },
  {
    label: "Hisaab",
    items: [
      { icon: "rupee", title: "Udhaar aur limit", text: "Cash aur UPI ke baad bacha paisa udhaar. Limit ke paas ya bahar ho to Bolo pehle batata hai." },
      { icon: "check", title: "Ek bill, ek baar", text: "Har bill ki apni pehchaan hai, isliye galti se do bill nahi katte." },
      { icon: "speaker", title: "Hindi mein read-back", text: "Bill katne se pehle poora hisaab sunaata hai, 'Phir suno' se dobara bhi." },
    ],
  },
  {
    label: "Bharosa",
    items: [
      { icon: "shield", title: "Haan ke bina kuch nahi", text: "Bina aapki haan ke na bill katta hai, na khata badalta hai." },
      { icon: "users", title: "Naam pe shak, toh sawaal", text: "Teen Afzal hain? Bolo poochhega kaunsa, andaaze se nahi chunega." },
      { icon: "pen", title: "Likho bhi sakte hain", text: "Shor zyada ho to Likho se haath se bill banaiye. Dono ek hi bill par kaam karte hain." },
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
              Bolo karo.
              <span className="hindi-line block" lang="hi">बिल बन जाएगा।</span>
            </h1>
            <p className="lead mt-6">
              Counter par boliye. Bolo bill banata hai, cash aur UPI alag karta hai, aur baaki udhaar khate mein
              likhta hai. Aapki haan ke baad hi bill katta hai.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
              <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Bolo kholo</Link>
              <Link href="/help" className="btn btn-outline">Kaise chalta hai</Link>
              <a href="#examples" className="btn btn-soft sm:col-span-2">Bolke dekhiye</a>
            </div>
          </div>
          <div className="flex justify-center md:justify-end"><PhoneMockup /></div>
        </section>

        <section className="site-section on-paper" aria-labelledby="steps-title">
          <div className="site-inner">
            <p className="eyebrow">Kaise chalta hai</p>
            <h2 id="steps-title" className="display display-lg mt-4">Teen kadam. Ek bill.</h2>
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
            <p className="eyebrow">Bolke dekhiye</p>
            <h2 id="examples-title" className="display display-lg mt-4">Aise boliye.</h2>
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
            <p className="eyebrow">Mandi ke liye bana</p>
            <h2 id="built-title" className="display display-lg mt-4">Counter ki bhaag-daud ke liye.</h2>
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
            <h2 id="start-title" className="display display-lg">Agla bill, bolke banaiye.</h2>
            <Link href="/app" className="btn btn-primary"><SiteIcon name="mic" />Bolo kholo</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
