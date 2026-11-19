<p align="center"><img src="public/logo.png" alt="Mandi Plus" width="320"></p>

# MandiPlus Bolo

Voice billing for a mandi trader. The trader speaks in Hindi or Hinglish, Bolo makes
the bill, splits the payment into cash / UPI / udhaar, checks the credit limit and
updates the khata.

## Status

- [x] Billing core: bill maths, payment split, credit limit check, one-time bill save
- [x] Customer search with fuzzy names ("Afzal" -> ask which one)
- [x] Vasooli and payment promises, by voice or by hand
- [x] Bill screen, voice billing and Hindi read-back
- [x] Login (email + password or Google), one shop per account, demo without login
- [x] Khata: customer list, running ledger, vasooli, vaade, adjustments with a reason
- [x] History by India day, printable receipts, WhatsApp share
- [x] Profile: shop details, rate list, owner PIN, backup download, daily backups
- [ ] Sharing a whole khata on WhatsApp
- [ ] Truck-wise reports

## Stack

Next.js 16, TypeScript, Tailwind, SQLite (built-in `node:sqlite`), Vitest.

## Run it

Needs Node 24 or newer.

```bash
npm install
cp .env.example .env.local   # optional: Google login, Sarvam, data folder
npm run seed     # rebuilds the shared demo shop (data/demo.db) from data/seed.json
npm test         # business rule tests
npm run dev      # http://localhost:3000
npm run dev:https  # same, with a self-signed certificate, for the mic on a tablet
```

`npm run seed` only touches the demo shop. Real shops are never reset by it.

| Page | What it is |
| --- | --- |
| `/` | Bolo product page |
| `/login`, `/signup` | Email + password, Google, or "Bina login demo dekhein" |
| `/app` | The counter: voice and touch billing |
| `/app/customers` | Khata: every customer, search, "limit ke paas" filter |
| `/app/customers/[id]` | One customer's ledger, vaade, vasooli, adjustments, edit |
| `/app/history` | Bills by India day with day totals; `/app/history/[id]` is the receipt |
| `/app/profile` | Shop details, rate list, owner PIN, backup, logout |
| `/help` | Voice commands and common questions |

## Accounts and data

Each account gets its own SQLite file, so one shop can never see another's data:

| File | Holds |
| --- | --- |
| `data/accounts.db` | Logins and login sessions (passwords are salted scrypt hashes) |
| `data/shops/<user id>.db` | That account's shop: customers, bills, khata, prices |
| `data/demo.db` | The shared demo shop with the sample customers |
| `data/backups/<user id>/` | One backup per India day, the newest 14 kept |

Set `BOLO_DATA_DIR` to move all of this to another folder. The owner PIN is an
optional second lock inside a shop: once set, changing prices, shop details,
credit limits, adding adjustments and downloading a backup ask for it.

Google login needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_ORIGIN` in
`.env.local`. In Google Cloud Console the OAuth client's authorized redirect URI is
`<APP_ORIGIN>/api/auth/google/callback`. Without these the Google button is hidden.

## Hosting

Bolo keeps its data in files, so it needs a normal Node server with a disk that
survives restarts: a VPS, or Railway, Render or Fly.io with a volume. Serverless
hosts lose the files. Run `npm run build` and `npm start` (or `npm run start:sarvam`),
point `BOLO_DATA_DIR` at the persistent disk, set `APP_ORIGIN` to the public HTTPS
address, and put the server behind HTTPS (the mic only works on HTTPS or localhost).

Company pages (service charges, support, privacy, terms) link to mandiplus.com.

## Use the mic

Open `http://localhost:3000/app` in Chrome (or the HTTPS address) and allow microphone access. Hold
**Daba ke bolo**, wait for **Sun raha hoon**, speak, then release it. Try “Manat ko 10 piece grade 1
aur 5 grade 2, 4 hazaar cash.” If several customers match, say the full name or
choose one from the customer list.

You can also speak in steps. Say “Vikas ko das piece,” then answer “do number”
when Bolo asks for the grade. If it asks how much cash arrived, say the amount.
You can ask “Vikas ka hisaab batao,” “Aaj kitni sale hui?” or “Sabse zyada
udhaar kiska hai?” Bolo reads the answer aloud and keeps the current bill.
“Today sale” also works after a bill is saved. Bolo speaks the total from
today's saved bills in India time. Chat shows the bill count and payment
methods used. On an empty day Bolo says “Aaj abhi tak koi bill nahi kata hai.”
The conversation pane also accepts typed commands. On a phone, tap **Bill** to
review the receipt and confirm, or **Bolo** to return to the same conversation.

Vasooli and vaade work by voice too. Say “Manat ne 5000 cash diye” or “Rahul parso
25 hazaar dega.” Bolo says back the new udhaar or the due date and asks “likh doon?”.
Nothing is written until you say “haan”; “nahi” drops it. If the cash or UPI is not
said, Bolo saves it as “mode nahi bataya” instead of guessing. During an open bill,
“diye” means that bill's payment; say “vasooli” to write it to the khata instead.

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
- A khata line is never edited or deleted. Mistakes are fixed with an adjustment line that says why.
- Dates are shown in India time; the database stores UTC.
- `tests/voice_cases.yaml` has 50 spoken commands with expected results (in rupees).
