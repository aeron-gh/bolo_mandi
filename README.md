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
**Daba ke bolo**, wait for **Sun raha hoon**, speak, then release it. Try “Manat ko 10 piece grade 1
aur 5 grade 2, 4 hazaar cash.” If several customers match, say the full name or
choose one from the customer list.

You can also speak in steps. Say “Vikas ko das piece,” then answer “do number”
when Bolo asks for the grade. If it asks how much cash arrived, say the amount.
You can ask “Vikas ka hisaab batao,” “Aaj kitni sale hui?” or “Sabse zyada
udhaar kiska hai?” Bolo reads the answer aloud and keeps the current bill.
The conversation pane also accepts typed commands. Aarav Mehta is a demo
owner label for the workspace.

Bolo reads back the total, payment split, new udhaar and any credit warning in
Hindi using the browser's speech voice. Check the receipt, then say “haan, kaat
do” or tap the confirmation button. For a correction, try “grade 2 nahi, grade
1 kar” or edit in **Likho**. Use **Phir suno** to replay the read-back.

Supported voice commands cover billing, payment splits, corrections and
cancellation. If browser recognition fails, Bolo transcribes the recording on
your device. The first fallback needs an internet connection to download the
Hinglish model and runtime (about 120 MB). The browser caches those files
for later use. Bolo starts loading the fallback while you speak when it
already knows the browser service is unavailable. The browser or OS supplies
the read-back voice. **Likho** works without the mic.

### Sarvam live transcription

Set `SARVAM_API_KEY` in `.env.local` and run `npm run dev:sarvam`. For a
production build on a Node host, run `npm run build` and
`npm run start:sarvam`. The Sarvam server listens on loopback. For HTTPS access
from other devices, put it behind an authenticated reverse proxy that preserves
the original Host and WebSocket upgrades, and set `SARVAM_PUBLIC_ORIGIN` to
the exact public origin (for example `https://bolo.example.com`).

The Sarvam path streams mic audio to Saaras v4 in Fast mode. Interim words
appear while you hold the mic. Releasing it requests a final Hindi/English
transcript, which feeds the normal billing workflow. Without a key the app
uses browser recognition and the on-device fallback. If the streaming
connection fails, Bolo can transcribe the same recording on-device.

## Rules the code follows

- Money is whole paise (integers). No floats anywhere.
- The maths lives in `lib/billing.ts`. Nothing else calculates totals.
- Every bill has a `draft_id`. Saving the same draft twice gives back the first bill,
  and the database column is `UNIQUE` so a second copy cannot exist.
- Over the credit limit, a bill is saved only after the trader says yes.
- `tests/voice_cases.yaml` has 50 spoken commands with expected results (in rupees).
