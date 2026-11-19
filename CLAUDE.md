# MandiPlus Bolo handoff

Bolo is a Next.js 16, TypeScript, and SQLite app for mandi traders. A trader can speak Hindi or Hinglish to draft a bill, check the receipt and credit position, then confirm the sale. The manual **Likho** flow remains available.

## Where to resume

Voice billing shipped to `origin/main` in two commits.

- [351cdc1](https://github.com/aeron-gh/bolo_mandi/commit/351cdc1bcbe385bd82b010d3f470d9d4378aa965) connected finalized speech to bill drafting, customer lookup, Hindi read-back, corrections, cancellation, and confirmation.
- [348fa76](https://github.com/aeron-gh/bolo_mandi/commit/348fa762d8a85a58f275f4a1113b055931280070) added an on-device fallback for browser speech failures, filtered repeated recognition artifacts, and let the trader answer follow-up questions about a missing grade or payment amount without repeating the bill.


The user's latest product priority is **low latency while speaking**, with natural Hindi/Hinglish prompts that carry context across turns and act on the answer. Bolo now supports optional Sarvam Saaras v4 Fast streaming with a server-side `SARVAM_API_KEY`. See the README for the Node startup commands. The paid transcription path sends microphone audio to Sarvam and keeps the key out of the browser. Billing still uses the deterministic parser and no general-purpose LLM. A live account and representative mandi audio are needed to measure end-to-end latency and accuracy. [Sarvam realtime streaming docs](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws)
The `shop-app` branch turns the counter into a full shop app: login (email + password or Google, no auth library), one SQLite file per account, a shared demo shop without login, a sidebar/tab shell, profile settings with an optional owner PIN, the khata (customers, ledger, vasooli, vaade, adjustments), bill history by India day with print and WhatsApp receipts, daily backups, and spoken vasooli and vaada ("Manat ne 5000 cash diye", "Rahul parso 25 hazaar dega") that Bolo says back and saves only after "haan". The design and plan are in `docs/design/2026-11-19-shop-app-*.md`. Still open: sharing a whole khata on WhatsApp and truck-wise reports. `tests/voice_cases.yaml` is a scenario catalog for the broader product, including features beyond the current voice flow.

## Run and try it

Use Node 24 or newer. Run `npm ci` and `npm run dev` (`npm run dev:https` for the mic on a tablet). `/app` needs a login or the demo choice on `/login`; `/` is the Bolo product page and `/help` lists voice commands. Secrets live in `.env.local` (git-ignored); `.env.example` lists every setting. Allow microphone access, hold **Daba ke bolo**, wait for **Sun raha hoon**, then speak and release.

The site uses the mandiplus.com look: brand purple `#4309AC`, Bricolage Grotesque headings, Geist text, Noto Sans Devanagari for Hindi. Shared site pieces live in `app/_site/`. Company pages link to the real mandiplus.com pages (`app/_site/links.ts`); do not copy their text, prices, contacts or images.

**The seed command recreates the demo shop.** `npm run seed` replaces `data/demo.db` only; account shops in `data/shops/` are never touched. A new account starts with an empty shop and the data sheet's prices. Schema changes go through `lib/migrations.ts` (`PRAGMA user_version`), which keeps existing data.

1. Say “Vikas ko das piece.” Bolo selects Vikas and asks for the grade.
2. Say “do number.” Bolo fills in grade 2 and reads the draft back.
3. Say “das hazaar cash.” Bolo adds the cash and reads the updated draft back.
4. Say “haan, kaat do” or tap the confirmation button after checking the updated receipt. For an ambiguous name such as Afzal, say the full name or choose one from the list.

## Code map

| File | Responsibility |
| --- | --- |
| [mic-button.tsx](app/_bill/mic-button.tsx) | Press-to-talk capture with `getUserMedia` and `MediaRecorder`, recording and processing status, cancellation, and resource cleanup. |
| [browser-recognition.ts](app/_bill/browser-recognition.ts) | Browser Web Speech recognition in `hi-IN`. Shows interim text and passes finalized text after release. Service failures trigger the fallback with the same recording. |
| [on-device-speech.ts](app/_bill/on-device-speech.ts), [transcribe.worker.ts](app/_bill/transcribe.worker.ts) | Decode to 16 kHz audio, skip effectively silent recordings, and run the quantized Whisper Hindi2Hinglish Swift model in a Web Worker via Transformers.js and WASM. The pinned model and runtime total about 120 MB on first download. The browser can cache the files. |
| [voice-text.ts](lib/voice-text.ts), [spoken-name.ts](lib/spoken-name.ts) | Reject repetitive or oversized recognition output and transliterate Devanagari names for the existing customer directory. |
| [voice.ts](lib/voice.ts), [voice route](app/api/bills/voice/route.ts), [api.ts](lib/api.ts) | Interpret supported Hindi/Hinglish commands, look up customers, and return bill edits, follow-ups, or intents. `POST /api/bills/voice` does not save bills. |
| [bill-screen.tsx](app/_bill/bill-screen.tsx), [draft.ts](lib/draft.ts) | Hold the draft and unresolved follow-up, manage customer selection, preview the current bill, and gate confirmation. Voice and manual inputs share the draft. |
| [readback.ts](lib/readback.ts), [speech.ts](app/_bill/speech.ts) | Build and play Hindi read-back using browser speech synthesis. The receipt and replay control provide the same review path. |
| [billing.ts](lib/billing.ts), [ledger.ts](lib/ledger.ts), [db.ts](lib/db.ts), [migrations.ts](lib/migrations.ts) | Integer-paise billing, credit checks, transactional SQLite saves, the khata, vasooli, promises, adjustments, and safe schema upgrades. |
| [accounts.ts](lib/accounts.ts), [google.ts](lib/google.ts), [shops.ts](lib/shops.ts), [server.ts](lib/server.ts), [proxy.ts](proxy.ts) | Logins and 30-day sessions, Google code flow with PKCE, which file holds which shop, and the per-request shop lookup. The proxy only checks that a login cookie exists; routes and pages check it properly. |
| [shop.ts](lib/shop.ts), [auth.ts](lib/auth.ts), [shop-api.ts](lib/shop-api.ts) | Shop details, the rate list, and the optional owner PIN that guards settings, limits, adjustments and backups. |
| [customer-list.ts](lib/customer-list.ts), [khata-api.ts](lib/khata-api.ts), [app/app/customers](app/app/customers) | Khata list and filters, customer edits, vasooli, vaade and adjustments with request checks. |
| [history.ts](lib/history.ts), [app/app/history](app/app/history) | Bills by India day, day totals, the receipt text and the WhatsApp link. |
| [talk.ts](lib/talk.ts) | What Bolo says around spoken vasooli and vaada: the question with the new udhaar or date, and what changed after "haan". |
| [backup.ts](lib/backup.ts) | One backup per India day per shop (newest 14 kept) and the owner's download. |

The browser recognition path can show text while the trader speaks. The local Whisper fallback can warm up during capture, but inference uses the finished recording after release. Interim text must never act on a bill. Resolve pending questions and review a fresh preview before confirming. Keep all money in whole paise and reuse `lib/billing.ts` for totals. The save API enforces credit checks and uses a unique `draft_id` so retries cannot create a second bill.

## Verification at handoff

Bolo now answers account, today's sales, and highest outstanding balance questions while preserving the draft. The workspace pairs a conversation log and typed composer with the bill panel. The welcome greets the shop owner by first name. The desktop pairs the assistant with a live receipt slip ("Kaccha bill" until saved, then "Pakka bill") and the shop's rate list. On phones, the assistant and current bill are two views of the same mounted draft. Bill review, confirmation, and new-bill actions live with the receipt. The voice control is a CSS waveform button with a halo driven by microphone volume. It respects reduced motion and supports holding the pointer, Space, or Enter. The welcome screen uses the larger control and the active conversation uses a compact version of that same button. Workspace styling is in `app/globals.css`.

- Daily sales use saved bills for the Indian calendar date. The report recognizes short English, Hindi, and Hinglish questions including “today sale.” It speaks one total or a single empty-day message. Chat includes the bill count and nonzero payment amounts. Read-only questions remain available after saving or cancelling a bill. A bare “haan” after a report while the bill awaits confirmation prompts a fresh read-back.
- `npm test` passed all 259 tests on the shop-app branch (144 before it). `npm run lint`, `npm run typecheck`, `git diff --check`, and the default Turbopack production build passed. Chrome with live Sarvam transcribed a synthetic Hindi sales question and delivered the empty-day message to speech synthesis. A separate temporary database verified the ₹800 total after confirmation and continued questions on the saved bill.
- A live Sarvam Chrome test used three synthesized Hindi clips. Bolo drafted an order, answered a spoken account question while the grade was pending, then applied the spoken grade to the same draft. The test issued no save request.
- The Chrome smoke test used synthesized Hindi recordings and an injected browser speech-service failure. The real fallback transcribed three turns, filled in the customer, grade, and cash, and saved one bill after explicit confirmation in a temporary SQLite database. In that run the cold fallback took about 25 seconds after release including model setup, while the two warm turns took about 2.1 seconds each. These timings are from one machine, and live trader audio in a noisy mandi still needs testing.
