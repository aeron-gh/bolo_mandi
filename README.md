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
- [x] Voice billing and Hindi read-back
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

## Use the mic

Open Bolo in Chrome on localhost or HTTPS and allow microphone access. Hold
**Daba ke bolo** while speaking, then release it. Try “Manat ko 10 piece grade 1
aur 5 grade 2, 4 hazaar cash.” If several customers match, say the full name or
choose one from the customer list.

Bolo reads back the total, payment split, new udhaar and any credit warning in
Hindi using the browser's speech voice. Check the receipt, then say “haan, kaat
do” or tap the confirmation button. For a correction, try “grade 2 nahi, grade
1 kar” or edit in **Likho**. Use **Phir suno** to replay the read-back.

Supported voice commands cover billing, payment splits, corrections and
cancellation. The browser or OS supplies speech recognition and synthesis, so
availability and voices depend on the device. **Likho** works without the mic.

## Rules the code follows

- Money is whole paise (integers). No floats anywhere.
- The maths lives in `lib/billing.ts`. Nothing else calculates totals.
- Every bill has a `draft_id`. Saving the same draft twice gives back the first bill,
  and the database column is `UNIQUE` so a second copy cannot exist.
- Over the credit limit, a bill is saved only after the trader says yes.
- `tests/voice_cases.yaml` has 50 spoken commands with expected results (in rupees).
