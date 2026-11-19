<p align="center"><img src="public/logo.png" alt="Mandi Plus" width="320"></p>

# MandiPlus Bolo

Voice billing for a mandi trader. The trader speaks in Hindi or Hinglish, Bolo makes
the bill, splits the payment into cash / UPI / udhaar, checks the credit limit and
updates the khata.

## Status

- [x] Billing core: bill maths, payment split, credit limit check, one-time bill save
- [x] Customer search with fuzzy names ("Afzal" -> ask which one)
- [x] Vasooli and payment promises
- [x] Bill screen
- [ ] Voice in and out
- [ ] Print and WhatsApp ledger
- [ ] Daily and truck-wise reports

## Stack

Next.js 16, TypeScript, Tailwind, SQLite (built-in `node:sqlite`), Vitest.

## Run it

Needs Node 24 or newer.

```bash
npm install
npm run seed     # creates data/bolo.db from data/seed.json
npm test         # business rule tests
npm run dev      # http://localhost:3000
```

## Rules the code follows

- Money is whole paise (integers). No floats anywhere.
- The maths lives in `lib/billing.ts`. Nothing else calculates totals.
- Every bill has a `draft_id`. Saving the same draft twice gives back the first bill,
  and the database column is `UNIQUE` so a second copy cannot exist.
- Over the credit limit, a bill is saved only after the trader says yes.
- `tests/voice_cases.yaml` has 50 spoken commands with expected results (in rupees).
