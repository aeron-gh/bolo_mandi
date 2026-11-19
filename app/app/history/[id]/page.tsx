import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/app/_app/print-button.tsx";
import { Icon } from "@/app/_bill/icons.tsx";
import { indiaDateTime } from "@/lib/dates.ts";
import { getBill, receiptText, whatsappLink } from "@/lib/history.ts";
import { formatRupees } from "@/lib/money.ts";
import { currentShop } from "@/lib/server.ts";
import { getShop } from "@/lib/shop.ts";

export const metadata: Metadata = { title: "Bill · Bolo" };

// One saved bill as a pakka receipt: print it or send it on WhatsApp (the owner still presses Send).
export default async function BillPage({ params }: PageProps<"/app/history/[id]">) {
  const { db } = await currentShop();
  const { id } = await params;
  const bill = /^\d+$/.test(id) ? getBill(db, Number(id)) : null;
  if (!bill) notFound();
  const shop = getShop(db);
  const text = receiptText(bill, shop);

  return (
    <main className="page page-receipt">
      <nav aria-label="Breadcrumb" className="crumbs no-print">
        <Link href="/app/history">History</Link><span aria-hidden>/</span><span>Bill {bill.id}</span>
      </nav>

      <article className="bill-paper receipt-sheet" aria-label={`Bill ${bill.id}`}>
        <header className="receipt-shop">
          {shop.shopName && <h1>{shop.shopName}</h1>}
          {shop.address && <p>{shop.address}</p>}
          {shop.phone && <p>Mobile {shop.phone}</p>}
        </header>
        <div className="receipt-meta">
          <span>Pakka bill {bill.id}</span>
          <span>{indiaDateTime(bill.createdAt)}</span>
        </div>
        <p className="receipt-customer">{bill.customerName}</p>
        <table className="ledger receipt-items">
          <thead><tr><th scope="col">Maal</th><th scope="col" className="num">Qty × Rate</th><th scope="col" className="num">Rakam</th></tr></thead>
          <tbody>
            {bill.items.map((item, i) => (
              <tr key={i}>
                <td>Grade {item.grade}</td>
                <td className="num">{item.qty}{item.unit === "crate" ? " crate" : ""} × {formatRupees(item.rate)}{item.rateOverride ? " *" : ""}</td>
                <td className="num">{formatRupees(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="receipt-totals">
          <div className="slip-total"><dt>Total</dt><dd><strong>{formatRupees(bill.total)}</strong></dd></div>
          {bill.cash > 0 && <div><dt>Cash</dt><dd>{formatRupees(bill.cash)}</dd></div>}
          {bill.upi > 0 && <div><dt>UPI</dt><dd>{formatRupees(bill.upi)}</dd></div>}
          {bill.udhaar > 0 && <div><dt>Udhaar</dt><dd>{formatRupees(bill.udhaar)}</dd></div>}
          <div className="receipt-balance">
            <dt>{bill.outstandingAfter < 0 ? "Advance jama" : "Kul udhaar ab"}</dt>
            <dd>{formatRupees(Math.abs(bill.outstandingAfter))}</dd>
          </div>
        </dl>
        {bill.items.some((item) => item.rateOverride) && <p className="panel-note">* Bolte waqt bataya gaya rate.</p>}
        {bill.overLimit && <p className="panel-note">Yeh bill limit se upar owner ki haan par kata.</p>}
      </article>

      <div className="khata-actions no-print">
        <PrintButton />
        <a className="btn btn-primary" href={whatsappLink(text, bill.customerPhone)} target="_blank" rel="noopener noreferrer">
          <Icon name="share" /> {bill.customerName} ko WhatsApp karo
        </a>
        <Link href={`/app/customers/${bill.customerId}`} className="btn btn-outline">Khata dekho</Link>
      </div>
      {!bill.customerPhone && <p className="panel-note no-print">{bill.customerName} ka mobile khate mein nahi hai, isliye WhatsApp mein contact khud chunna hoga.</p>}
    </main>
  );
}
