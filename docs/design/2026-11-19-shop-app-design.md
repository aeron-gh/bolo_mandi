# Bolo for the shop owner (`/app`)

## Why

A real mandi shop owner will use `/app` every day, at the counter, on the shop's own laptop or tablet:
make bills, keep each customer's khata, look back at past bills, and manage their own shop details and
prices. "Production ready" here means: each owner logs in to their own shop, data is never lost, and
nothing changes without the owner's say. Visitors can skip login and try a shared demo shop with the
sample customers (Manat, Afzal, Vikas…).

**Update (owner's answers):** login added — email + password and "Continue with Google"; one shop per
account; "skip login" opens the demo shop; built to run as a normal Node server with a data folder
(VPS, Railway, Render or Fly.io with a volume — not serverless hosts, which lose files).

## Goals

- **Login:** `/login` (email + password, "Continue with Google", "Demo dekhein"), `/signup` (name, email,
  password, shop name), logout from the profile. `/app` needs a login or the demo choice.
- **Own shop per account:** `data/accounts.db` holds users and login sessions; each user's shop is
  `data/shops/<user id>.db`; the demo shop is `data/demo.db`, seeded from `data/seed.json`, with a
  "Demo reset" button and a banner that it is shared.
- **Shell:** real pages with a tab bar on phones and a sidebar on laptops:
  `/app` (Bill), `/app/customers` (Khata), `/app/customers/[id]`, `/app/history`,
  `/app/history/[billId]`, `/app/profile`. The owner avatar is clickable and opens the profile.
- **Bill in progress survives** switching tabs, a page refresh or a power cut (saved on the device).
- **Profile & settings:** shop name, owner name, phone, address; the price list per grade is editable and
  new bills use it; the owner sets a PIN.
- **Customers & khata:** list with search, sort by udhaar and a "limit ke paas" filter; each customer's
  khata with dates in India time, running balance and open promises; add a customer; edit name, phone and
  credit limit; record vasooli (cash, UPI or not said; advance needs an explicit yes); record a promise;
  start a new bill for this customer; fix mistakes with an adjustment line (never by deleting).
- **History:** bills grouped by India date with day totals (cash, UPI, udhaar); open any bill as a receipt;
  filter by customer. A receipt can be printed (browser print) or shared on WhatsApp (a `wa.me` link with
  the bill text; the owner still presses Send).
- **Restore rule:** a bill restored after a refresh comes back as DRAFT (the owner must hear the read-back
  again before saying yes). It keeps its `draft_id`, so if it was already saved, confirming returns the same
  bill. Saved or cancelled bills are never restored.
- **Promises:** open promises show on the khata; overdue ones stand out; the owner marks one kept or broken.
- **Hardening:** PIN needed for settings, price changes, credit-limit changes and adjustments; database
  upgrades never wipe data; a daily automatic backup plus a "Backup download" button; clear empty and
  error states; installable on a phone home screen; a one-line HTTPS start for using the mic on a tablet.

## Non-goals

- Cloud database, staff roles, phone OTP, "forgot password" emails (needs an email service), several
  shops per account.
- GST invoices. Sharing a whole khata on WhatsApp (roadmap step 6). Truck reports (step 7).
- Deleting bills or ledger lines.

## Anti-goals (failures even if it looks right)

- Any upgrade or restart that loses or resets real shop data (`npm run seed` stays a developer tool for an
  empty database only).
- A past khata line silently edited or removed.
- Money stored as floats; any save without the owner's explicit yes; dates shown in UTC.

## Constraints

- Golden rules in `CLAUDE.local.md` still hold (paise integers, explicit yes, unique `draft_id`, ask on
  ambiguous names).
- Next.js 16 rules: `await connection()` before database reads in GET handlers; no `Date.now()` or random
  values during render.
- No new npm packages: PIN hashing with `node:crypto` (`scrypt`), backups with `node:sqlite`'s `backup()`.
- Works at 390px phone width with no sideways scroll; the 146 existing tests stay green.

## Approaches considered

| Decision | Options | Picked |
| --- | --- | --- |
| Where it runs | One shop on one device · online for many shops · demo first | First **one shop, one device**; updated to **own shop per account + demo**, Node server with a data folder (owner) |
| Login | Email + password · phone OTP · Google only | **Email + password + Google** (owner) |
| Google login | No library (code flow + PKCE, token from Google over TLS) · Auth.js | **No library** (owner) |
| Account data | One SQLite file per account · one shared database | **One file per account** (owner): shops cannot see each other |
| Moving around `/app` | Real pages + tab bar · tabs inside one page · sheets over the counter | **Real pages + tab bar** (owner) |
| Changing tables safely | Numbered migrations tracked in `PRAGMA user_version` · wipe and reseed | **Migrations** (builder's call): real data must survive |
| Fixing khata mistakes | Adjustment lines with a reason · edit or delete old lines | **Adjustment lines** (builder's call): every rupee stays traceable |
| PIN | `scrypt` hash in the database + short-lived httpOnly session cookie · plain text · browser-only check | **Hash + session** (builder's call): the server checks it, not just the screen |

## Data changes (as migrations)

1. `shop` (one row): shop name, owner name, phone, address, PIN hash and salt.
2. `rates` (grade → paise): filled from `seed.json` on first run; bills read prices from here.
3. `ledger_entries`: allow kind `adjustment`, add a `note` column.
4. `sessions`: PIN unlock tokens with an expiry.
5. Indexes for history by date and khata by customer.

## Login details

- Passwords: at least 8 characters, stored as salted scrypt hashes; the same error for a wrong email or a
  wrong password; 5 wrong tries for one email → 5-minute pause.
- Login session: random 64-hex token in an httpOnly cookie `bolo_user`, valid 30 days, stored in
  `accounts.db`. Demo choice: cookie `bolo_demo=1`. The owner PIN (cookie `bolo_session`) stays as an
  optional extra lock inside a shop.
- Google: authorization code flow with PKCE (S256), random `state` and `nonce` in short-lived httpOnly
  cookies; the ID token is taken straight from Google's token endpoint over TLS (OIDC Core 3.1.3.7) and
  checked for issuer, audience, expiry, nonce and verified email. A Google login with the same verified
  email as an existing account joins that account. Settings come from `.env.local`:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_ORIGIN`. Without them the Google button is hidden.
- The in-progress bill on a device is saved per shop, so the demo's draft never appears in a real shop.

## Build order (each step ships on its own)

| Step | Contents |
| --- | --- |
| L | Accounts, login/signup/demo, Google login, every route and page reads the signed-in shop's database |
| A | Migrations, app shell (tabs/sidebar), draft autosave, Profile & settings (shop info, prices, PIN setup) |
| B | Customers & khata (list, detail, add/edit, vasooli, promise, adjustment, new bill for customer) |
| C | History (by day, totals, bill receipt, customer filter) |
| D | Hardening (PIN gates, backups, empty/error states, install manifest, HTTPS start script) |

## How each step is checked

- New server functions are written test-first; API handlers tested through `lib/api.ts`.
- Headless screenshots at 1440px and 390px; page width equals screen width at 390px.
- Full suite, typecheck, lint and production build pass.
- Step A also proves an upgrade keeps data: a database with bills from today's schema is migrated and every
  bill and khata line is still there.

## Left to the builder

- Exact copy (short Hinglish), icons and spacing, within the MandiPlus look from
  `docs/design/2026-11-19-mandiplus-look.md`.
