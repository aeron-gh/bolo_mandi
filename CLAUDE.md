# MandiPlus Bolo handoff

Bolo is a Next.js 16, TypeScript, and SQLite app for mandi traders. A trader can speak Hindi or Hinglish to draft a bill, check the receipt and credit position, then confirm the sale. The manual **Likho** flow remains available.

## Where to resume

Voice billing shipped to `origin/main` in two commits.

- [351cdc1](https://github.com/aeron-gh/bolo_mandi/commit/351cdc1bcbe385bd82b010d3f470d9d4378aa965) connected finalized speech to bill drafting, customer lookup, Hindi read-back, corrections, cancellation, and confirmation.
- [348fa76](https://github.com/aeron-gh/bolo_mandi/commit/348fa762d8a85a58f275f4a1113b055931280070) added an on-device fallback for browser speech failures, filtered repeated recognition artifacts, and let the trader answer follow-up questions about a missing grade or payment amount without repeating the bill.

The user's latest product priority is **low latency while speaking**, with natural Hindi/Hinglish prompts that carry context across turns and act on the answer. The current app uses **zero LLM API keys**. Sarvam Saaras streaming speech-to-text was discussed as the next candidate to evaluate for Hindi/English code-switching. No streaming provider is integrated and no API key is configured. A Sarvam integration would need a server-side key and would send microphone audio to the provider. Keep the key out of client code and Git. Benchmark interim text latency, end-of-turn latency, and accuracy on representative mandi audio before choosing a provider. [Sarvam streaming docs](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/ws)

The README backlog also includes print and WhatsApp ledger sharing, followed by daily and truck-wise reports. The existing ledger logic supports vasooli and promises, and the voice bill parser's scope is billing. `tests/voice_cases.yaml` is a scenario catalog for the broader product, including features beyond the current voice flow.

## Run and try it

Use Node 24 or newer. Run `npm ci` and `npm run dev`. Open Chrome at `http://localhost:3000` or use HTTPS, allow microphone access, hold **Daba ke bolo**, wait for **Sun raha hoon**, then speak and release.

**The seed command recreates the database.** The app initializes an empty store from the seed automatically. Use `npm run seed` only when you intend to replace `data/bolo.db` and its SQLite sidecar files.

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
| [billing.ts](lib/billing.ts), [ledger.ts](lib/ledger.ts), [db.ts](lib/db.ts) | Integer-paise billing, credit checks, transactional SQLite saves, the khata, vasooli, and promises. |

The browser recognition path can show text while the trader speaks. The local Whisper fallback can warm up during capture, but inference uses the finished recording after release. Interim text must never act on a bill. Resolve pending questions and review a fresh preview before confirming. Keep all money in whole paise and reuse `lib/billing.ts` for totals. The save API enforces credit checks and uses a unique `draft_id` so retries cannot create a second bill.

## Verification at handoff

- `npm test` passed all 123 tests. `npm run lint`, `npm run typecheck`, and `git diff --check` passed.
- `npm run build -- --webpack` passed. The default Turbopack production build hit a local port-binding restriction in this environment during the earlier verification. The running local dev page responded and generated the worker bundle.
- The Chrome smoke test used synthesized Hindi recordings and an injected browser speech-service failure. The real fallback transcribed three turns, filled in the customer, grade, and cash, and saved one bill after explicit confirmation in a temporary SQLite database. In that run the cold fallback took about 25 seconds after release including model setup, while the two warm turns took about 2.1 seconds each. These timings are from one machine, and live trader audio in a noisy mandi still needs testing.
