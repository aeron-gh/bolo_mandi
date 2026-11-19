import type { Metadata } from "next";
import Link from "next/link";
import { NewCustomerButton } from "@/app/_app/khata-forms.tsx";
import { listCustomers, type ListOptions } from "@/lib/customer-list.ts";
import { formatRupees } from "@/lib/money.ts";
import { currentShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "Khata · Bolo" };

const CREDIT_WORDS = { ok: "", near: "Limit ke paas", over: "Limit se upar" } as const;

// Every customer with their udhaar. Search, filter and sort live in the address, so Back keeps them.
export default async function CustomersPage({ searchParams }: PageProps<"/app/customers">) {
  const { db } = await currentShop();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const filter: ListOptions["filter"] = params.filter === "udhaar" || params.filter === "limit" ? params.filter : "all";
  const sort: ListOptions["sort"] = params.sort === "name" ? "name" : "udhaar";
  const everyone = listCustomers(db, {});
  const rows = listCustomers(db, { q, filter, sort });
  const owed = everyone.reduce((sum, row) => sum + Math.max(0, row.outstanding), 0);
  const nearCount = everyone.filter((row) => row.credit !== "ok").length;
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({ ...(q && { q }), ...(filter !== "all" && { filter }), ...(sort !== "udhaar" && { sort }), ...change });
    for (const [key, value] of [...next]) if (!value || (key === "filter" && value === "all") || (key === "sort" && value === "udhaar")) next.delete(key);
    return `/app/customers${next.size ? `?${next}` : ""}`;
  };

  return (
    <main className="page">
      <header className="page-head page-head-row">
        <div>
          <h1>Khata</h1>
          <p>{everyone.length} customer, kul udhaar {formatRupees(owed)}</p>
        </div>
        <NewCustomerButton />
      </header>

      <div className="list-tools">
        <form action="/app/customers" className="search-box" role="search">
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Naam ya mobile se dhoondo" aria-label="Customer dhoondo" />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          {sort !== "udhaar" && <input type="hidden" name="sort" value={sort} />}
        </form>
        <nav className="chip-row" aria-label="Filter">
          <Link href={link({ filter: "all" })} className="chip" aria-current={filter === "all" ? "page" : undefined}>Sab</Link>
          <Link href={link({ filter: "udhaar" })} className="chip" aria-current={filter === "udhaar" ? "page" : undefined}>Jinka udhaar hai</Link>
          <Link href={link({ filter: "limit" })} className="chip" aria-current={filter === "limit" ? "page" : undefined}>Limit ke paas ({nearCount})</Link>
          <Link href={link({ sort: sort === "name" ? "udhaar" : "name" })} className="chip chip-sort">
            {sort === "name" ? "Naam se" : "Zyada udhaar pehle"}
          </Link>
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          {everyone.length === 0
            ? <><h2>Abhi koi customer nahi</h2><p>Pehla bill banate hi customer yahan dikhega, ya upar se naya customer jodo.</p></>
            : <><h2>Koi nahi mila</h2><p>{q ? `"${q}" se koi naam ya mobile nahi milta.` : "Is filter mein koi customer nahi."} <Link href="/app/customers" className="text-link">Sab dikhao</Link></p></>}
        </div>
      ) : (
        <ul className="sheet-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/app/customers/${row.id}`} className="customer-row">
                <span className="customer-name">
                  <strong>{row.name}</strong>
                  {row.phone && <small>{row.phone}</small>}
                </span>
                <span className="customer-money">
                  <strong className={row.outstanding < 0 ? "is-advance" : ""}>{row.outstanding < 0 ? `${formatRupees(-row.outstanding)} advance` : formatRupees(row.outstanding)}</strong>
                  {row.credit !== "ok" && <small className={`credit-${row.credit}`}>{CREDIT_WORDS[row.credit]}</small>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
