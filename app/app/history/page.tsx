import type { Metadata } from "next";
import Link from "next/link";
import { indiaDateTime, indiaDayLabel } from "@/lib/dates.ts";
import { dayTotals, indiaDay, listBills, type BillSummary } from "@/lib/history.ts";
import { formatRupees } from "@/lib/money.ts";
import { currentShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "History · Bolo" };

// "Aaj" and "Kal" read better than dates for the last two days.
function dayName(day: string, today: string): string {
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === today) return `Aaj, ${indiaDayLabel(day)}`;
  if (day === yesterday.toISOString().slice(0, 10)) return `Kal, ${indiaDayLabel(day)}`;
  return indiaDayLabel(day);
}

function groupByDay(bills: BillSummary[]): [string, BillSummary[]][] {
  const groups = new Map<string, BillSummary[]>();
  for (const bill of bills) groups.set(bill.day, [...(groups.get(bill.day) ?? []), bill]);
  return [...groups];
}

const sum = (bills: BillSummary[], key: "total" | "cash" | "upi" | "udhaar") => bills.reduce((s, b) => s + b[key], 0);

// Bills by India day, newest first; one day or one customer via the address.
export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const { db } = await currentShop();
  const params = await searchParams;
  const today = indiaDay(new Date());
  const day = typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : undefined;
  const customerId = typeof params.customer === "string" && /^\d+$/.test(params.customer) ? Number(params.customer) : undefined;
  const bills = listBills(db, { day, customerId });
  const todayTotals = dayTotals(db, today);
  const customerName = customerId ? (db.prepare("SELECT name FROM customers WHERE id = ?").get(customerId) as { name: string } | undefined)?.name : undefined;

  return (
    <main className="page">
      <header className="page-head">
        <h1>History</h1>
        <p>Har kata hua bill, India ki taarikh ke hisaab se.</p>
      </header>

      <section className="today-strip" aria-label="Aaj ki sale">
        <div><span>Aaj ki sale</span><strong>{formatRupees(todayTotals.total)}</strong></div>
        <div><span>Bill</span><strong>{todayTotals.bills}</strong></div>
        <div><span>Cash</span><strong>{formatRupees(todayTotals.cash)}</strong></div>
        <div><span>UPI</span><strong>{formatRupees(todayTotals.upi)}</strong></div>
        <div><span>Udhaar</span><strong>{formatRupees(todayTotals.udhaar)}</strong></div>
      </section>

      <div className="list-tools">
        <form action="/app/history" className="day-form">
          <label className="field">Taarikh chuno
            <input className="input" type="date" name="day" defaultValue={day} max={today} />
          </label>
          {customerId && <input type="hidden" name="customer" value={customerId} />}
          <button className="btn btn-outline">Dikhao</button>
        </form>
        {(day || customerName) && (
          <p className="filter-note">
            {customerName && <>Sirf <strong>{customerName}</strong> ke bills. </>}
            {day && <>Sirf {indiaDayLabel(day)}. </>}
            <Link href="/app/history" className="text-link">Sab bills dikhao</Link>
          </p>
        )}
      </div>

      {bills.length === 0 ? (
        <div className="empty-state">
          <h2>{day || customerName ? "Is filter mein koi bill nahi" : "Abhi koi bill nahi kata"}</h2>
          <p>{day || customerName ? <Link href="/app/history" className="text-link">Sab bills dikhao</Link> : <>Pehla bill <Link href="/app" className="text-link">Bill</Link> tab se banaiye.</>}</p>
        </div>
      ) : (
        groupByDay(bills).map(([groupDay, group]) => (
          <section key={groupDay} className="sheet" aria-label={dayName(groupDay, today)}>
            <header className="day-head">
              <h2>{dayName(groupDay, today)}</h2>
              <p>{group.length} bill, {formatRupees(sum(group, "total"))}. Cash {formatRupees(sum(group, "cash"))}, UPI {formatRupees(sum(group, "upi"))}, udhaar {formatRupees(sum(group, "udhaar"))}.</p>
            </header>
            <ul className="sheet-list flat">
              {group.map((bill) => (
                <li key={bill.id}>
                  <Link href={`/app/history/${bill.id}`} className="customer-row">
                    <span className="customer-name">
                      <strong>{bill.customerName}</strong>
                      <small>Bill {bill.id}, {indiaDateTime(bill.createdAt).split(", ")[1]}</small>
                    </span>
                    <span className="customer-money">
                      <strong>{formatRupees(bill.total)}</strong>
                      {bill.udhaar > 0 && <small className="panel-note">{formatRupees(bill.udhaar)} udhaar</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
