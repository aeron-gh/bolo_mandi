import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KhataActions, PromiseButtons } from "@/app/_app/khata-forms.tsx";
import { checkCreditLimit } from "@/lib/billing.ts";
import { indiaDateTime, indiaDayLabel } from "@/lib/dates.ts";
import { getKhata, type Khata, type KhataLine } from "@/lib/ledger.ts";
import { formatRupees } from "@/lib/money.ts";
import { currentShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "Ledger · Bolo" };

// What one ledger line was, in the trader's words.
function lineLabel(line: KhataLine) {
  if (line.kind === "opening") return "Opening balance";
  if (line.kind === "bill") return line.billId ? <Link href={`/app/history/${line.billId}`} className="text-link">Bill {line.billId}</Link> : "Bill";
  if (line.kind === "payment") return `Payment, ${line.mode === "cash" ? "cash" : line.mode === "upi" ? "UPI" : "mode not said"}`;
  return `Correction: ${line.note ?? ""}`;
}

// Plus means the customer owes more, minus means less.
const signed = (paise: number) => (paise > 0 ? `+${formatRupees(paise)}` : paise < 0 ? `−${formatRupees(-paise)}` : formatRupees(0));

function load(db: Parameters<typeof getKhata>[0], id: string): Khata | null {
  if (!/^\d+$/.test(id)) return null;
  try {
    return getKhata(db, Number(id), new Date());
  } catch {
    return null;
  }
}

export default async function CustomerPage({ params }: PageProps<"/app/customers/[id]">) {
  const { db } = await currentShop();
  const { id } = await params;
  const khata = load(db, id);
  if (!khata) notFound();
  const credit = checkCreditLimit(khata.outstanding, 0, khata.creditLimit).status;
  const lines = [...khata.entries].reverse();

  return (
    <main className="page">
      <nav aria-label="Breadcrumb" className="crumbs"><Link href="/app/customers">Ledger</Link><span aria-hidden>/</span><span>{khata.customer.name}</span></nav>
      <header className="khata-head">
        <div>
          <h1>{khata.customer.name}</h1>
          {khata.phone ? <a href={`tel:${khata.phone}`} className="text-link">{khata.phone}</a> : <span className="panel-note">No mobile number</span>}
        </div>
        <dl className="khata-figures">
          <div><dt>{khata.outstanding < 0 ? "Advance" : "Credit"}</dt><dd className="figure-main">{formatRupees(Math.abs(khata.outstanding))}</dd></div>
          <div><dt>Limit</dt><dd>{formatRupees(khata.creditLimit)}</dd></div>
          <div><dt>Limit left</dt><dd className={`credit-${credit}`}>{formatRupees(khata.creditLeft)}</dd></div>
        </dl>
      </header>

      <KhataActions customer={khata.customer} phone={khata.phone} creditLimit={khata.creditLimit} />

      {khata.openPromises.length > 0 && (
        <section aria-labelledby="promises-title" className="sheet">
          <h2 id="promises-title" className="sheet-title">Promises</h2>
          <ul className="sheet-list flat">
            {khata.openPromises.map((promise) => (
              <li key={promise.id} className="promise-row">
                <span>
                  <strong>{formatRupees(promise.amount)}</strong> by {indiaDayLabel(promise.dueDate)}
                  {promise.overdue && <small className="credit-over"> Overdue</small>}
                </span>
                <PromiseButtons id={promise.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ledger-title" className="sheet">
        <div className="sheet-title-row">
          <h2 id="ledger-title" className="sheet-title">Account</h2>
          <Link href={`/app/history?customer=${khata.customer.id}`} className="text-link">All bills</Link>
        </div>
        <table className="ledger">
          <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Credit</th></tr></thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="when">{indiaDateTime(line.createdAt)}</td>
                <td>{lineLabel(line)}</td>
                <td className="num">{signed(line.amount)}</td>
                <td className="num">{formatRupees(line.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
