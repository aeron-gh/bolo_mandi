# Bolo for the shop owner — implementation plan

**Goal:** `/app` becomes a launch-ready single-shop tool: shell with tabs, profile & settings, customers &
khata, bill history, PIN, backups.

**Architecture:** Business logic stays in `lib/` as small tested functions that take the database as an
argument. API routes stay thin (`lib/server.ts` `reply`). Read-only screens are server components that call
`await connection()` and read `lib/` directly; forms are small client components that call the API and then
`router.refresh()`.

**Tech:** Next.js 16 App Router, `node:sqlite`, `node:crypto` (scrypt, randomBytes), Vitest. No new packages.

**Spec:** `docs/design/2026-11-19-shop-app-design.md`

## Global constraints

- Money in whole paise; nothing saved without an explicit tap or "haan"; unique `draft_id` on every write
  that a double tap could repeat (payments, promises, adjustments).
- Dates shown in India time: SQL `date(created_at, '+330 minutes')`; `created_at` stays UTC.
- PIN: 4 to 6 digits, scrypt hash + random salt, session cookie `bolo_session` (httpOnly, sameSite lax,
  12 hours). With no PIN set, protected actions are allowed and the UI asks the owner to set one.
- Protected actions: shop update, price update, PIN change, any credit-limit change (including a new
  customer with limit above 0), adjustments, backup download.
- Migrations: `PRAGMA user_version`; each migration runs once inside a transaction; never drop data.
- Next 16: `await connection()` before database reads in server components and GET handlers; no
  `Date.now()`/random during render; dynamic params are Promises.

## Review focus

1. Upgrading today's database file keeps every bill, khata line and balance (migration test).
2. A double tap on Vasooli, Promise or Adjustment writes once (`draft_id`).
3. A bill made at 23:00 India time (17:30 UTC) shows under the right India day in History.
4. Without the PIN cookie, protected API calls answer 401 and change nothing.
5. Restored drafts never come back as AWAITING_CONFIRM.

---

### Task 1: Migrations, shop, prices, PIN (lib)

**Files:** create `lib/migrations.ts`, `lib/shop.ts`, `lib/auth.ts`; modify `lib/db.ts` (`openDb` calls
`migrate`; export `BASE_SCHEMA`); tests `tests/migrations.test.ts`, `tests/shop.test.ts`, `tests/auth.test.ts`.

**Produces:**
- `migrate(db): number` (returns new version); `SCHEMA_VERSION` constant.
- Migrations: 1 `shop` single row; 2 `rates` filled from seed; 3 rebuild `ledger_entries` with kind
  `adjustment` and `note` column; 4 `sessions`; 5 indexes.
- `getShop(db): Shop` `{ shopName, ownerName, phone, address, hasPin }`; `updateShop(db, input): Shop`.
- `getRates(db): RateCard`; `updateRates(db, rates: RateCard): RateCard` (whole rupees, 1 to ₹1,00,000).
- `setPin(db, pin, currentPin?)`; `verifyPin(db, pin): boolean`; `createSession(db, now): string`;
  `sessionValid(db, token, now): boolean`; `endSession(db, token)`; `ownerAllowed(db, token, now): boolean`
  (true when no PIN is set or the session is valid).

**Tests:** fresh db reaches `SCHEMA_VERSION`; base-schema db with a saved bill, a payment and seed data keeps
counts, balances and `draft_id`s after `migrate`; adjustment kind insertable after migration; migrate twice is
a no-op; shop defaults empty and `hasPin` false; phone must be 10 digits or empty; names trimmed, max 60;
`getRates` equals seed rates; `updateRates` refuses 0, decimals, above ₹1,00,000; PIN format 4-6 digits;
wrong PIN false; changing PIN needs the current one; session expires after 12 hours; `ownerAllowed` true with
no PIN.

### Task 2: Shop API, price source, PIN gate in routes

**Files:** modify `lib/server.ts` (remove `RATES`; add `ownerToken(req)`, `requireOwner(db, req)`; `reply`
maps `PinRequired` to 401), the three bill routes (use `getRates(getDb())`); create `lib/shop-api.ts`
(`readShop`, `saveShop`, `savePrices`, `changePin`, `unlock`) + routes `app/api/shop/route.ts` (GET, PUT),
`app/api/rates/route.ts` (PUT), `app/api/pin/route.ts` (POST), `app/api/session/route.ts` (POST, DELETE);
test `tests/shop-api.test.ts`.

**Tests:** body validation messages; `PinRequired` thrown when a PIN is set and no valid token; prices saved
are used by the next `previewBill`.

### Task 2b: Accounts, login, Google, one shop per account

**Files:** create `lib/accounts.ts`, `lib/google.ts`, `lib/shops.ts`; rewrite `lib/server.ts` around the
signed-in shop; routes `app/api/auth/{signup,login,logout,demo,google/start,google/callback}/route.ts`,
`app/api/demo/reset/route.ts`; pages `app/login/page.tsx`, `app/signup/page.tsx` with client forms in
`app/_auth/`; every existing route switches from `getDb()` to the request's shop; `.env.example`;
`scripts/seed.ts` rebuilds the demo shop; tests `tests/accounts.test.ts`, `tests/google.test.ts`.

**Produces:**
- `openAccounts(file): DatabaseSync`; `signUp(db, {name, email, password}, now): User`;
  `logIn(db, {email, password}, now): User`; `createUserSession(db, userId, now): string`;
  `userForSession(db, token, now): User | null`; `endUserSession(db, token)`;
  `googleUser(db, {sub, email, name, emailVerified}, now): User`. `User = {id, name, email}`.
- `pkcePair(): {verifier, challenge}`; `googleAuthUrl(cfg, {state, challenge, nonce}): string`;
  `checkIdToken(idToken, {clientId, nonce, now}): {sub, email, name, emailVerified}`;
  `exchangeCode(cfg, code, verifier, fetchFn): Promise<string>` (returns the ID token).
- `DATA_DIR` (env `BOLO_DATA_DIR` or `./data`), `shopFile(userId)`, `DEMO_FILE`, `ACCOUNTS_FILE`.
- Server: `shopFor(req): {db, mode: "user" | "demo", user}` (throws `LoginRequired` → 401);
  `currentShop()` for server components (redirects to `/login`).

**Tests:** sign-up validation (email, 8-char password, duplicate email); login works and gives the same
error for wrong email and wrong password; 5 wrong tries pause that email for 5 minutes; sessions last
30 days and end on logout; Google user is created once, joined to a same-email password account, refused
when email not verified; ID token checks reject wrong issuer, audience, expired token, wrong nonce; PKCE
challenge is base64url SHA-256 of the verifier.

### Task 3: App shell, profile page, draft restore, start bill for a customer

**Files:** create `app/app/layout.tsx` (server: shop → `AppShell`), `app/_app/app-shell.tsx` (sidebar on lg,
bottom tabs on phone, avatar → `/app/profile`), `app/_app/nav-links.tsx` (client, `usePathname`),
`app/_app/pin-prompt.tsx` + `app/_app/use-owner-call.ts` (retry after PIN), `app/app/profile/page.tsx` +
`app/_app/profile-forms.tsx`; modify `app/app/page.tsx` (DB prices, `?customer=` preselect),
`lib/draft.ts` (`restoreDraft(saved: unknown): BillDraft | null`, action `restore`),
`app/_bill/bill-screen.tsx` (save draft to `localStorage` key `bolo-draft`, restore on mount, clear on
save/cancel/new), remove `app/_site/app-bar.tsx` use; test `tests/draft.test.ts` additions.

**Tests:** `restoreDraft` rejects junk, SAVED, CANCELLED and empty drafts; turns AWAITING_CONFIRM into DRAFT;
keeps `draftId`.

### Task 4: Customers & khata

**Files:** extend `lib/customers.ts` (`listCustomers(db, { q, sort, filter })`, `updateCustomer(db, id,
input)`), `lib/ledger.ts` (`recordAdjustment`, `setPromiseStatus`, `getKhata` adds `note`, entry id and
promise id/overdue); create `lib/khata-api.ts`; routes `app/api/customers/[id]/route.ts` (PATCH),
`app/api/payments/route.ts`, `app/api/promises/route.ts`, `app/api/promises/[id]/route.ts`,
`app/api/adjustments/route.ts`; pages `app/app/customers/page.tsx`, `app/app/customers/[id]/page.tsx`,
client forms in `app/_app/khata-forms.tsx`; tests `tests/customer-list.test.ts`, `tests/khata-api.test.ts`.

**Tests:** list search, sort by udhaar, near/over filter; edit refuses duplicate names and bad phones; limit
change needs owner; adjustment needs a note and non-zero amount, moves balance, writes once per `draft_id`;
promise status kept/broken; khata shows notes.

### Task 5: History & receipt

**Files:** create `lib/history.ts` (`indiaDay(now)`, `listBills(db, { day, customerId })`,
`dayTotals(db, day)`, `getBill(db, id)`, `receiptText(bill, shop)`); pages `app/app/history/page.tsx`,
`app/app/history/[id]/page.tsx`, `app/_app/receipt-actions.tsx` (print, WhatsApp); test
`tests/history.test.ts`.

**Tests:** India-day grouping across UTC midnight; totals match bills; bill detail lists items; receipt text
has shop name, items, totals and new udhaar.

### Task 6: Hardening

**Files:** create `lib/backup.ts` (`backupTo(db, file)`, `dailyBackup(db, dir, now)`, `pruneBackups(dir,
keep)`), route `app/api/backup/route.ts` (GET, owner only, file download); `getDb` triggers the daily backup;
`app/app/error.tsx`, `app/app/not-found.tsx`, empty states; `app/manifest.ts`; `package.json` script
`dev:https`; README + CLAUDE.md; test `tests/backup.test.ts`.

**Tests:** backup file opens with the same counts; daily backup made once per India day; prune keeps the
newest 14.

### Task 7: Verify

- Full suite, typecheck, lint, build.
- Screenshots of every `/app` page at 1440px and 390px; page width equals screen width at 390px.
- Live server: protected call without PIN → 401; with PIN → 200; vasooli double post → one line; restart
  keeps data; backup download opens.
