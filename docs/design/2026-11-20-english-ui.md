# English screen text

**Decision (owner, 2026-11-20):** buttons, menus, pages and system messages are in plain English. Bolo
*understands* Hindi and Hinglish speech (the parser in `lib/voice.ts` is unchanged), *speaks* Hindi aloud, and its
**chat bubbles show the same Hindi it speaks, in Devanagari** (the `speech` side of each reply). The English `text`
side feeds the hint under the bill's main button. Voice-command examples on the Help page stay in Hinglish,
because they are what traders say.

## Glossary

| Was | Now |
| --- | --- |
| Udhaar | Credit (the amount a customer owes) |
| Naya udhaar | New credit total |
| Limit baaki | Limit left |
| Khata | Ledger |
| Hisaab | Account / ledger lines |
| Vasooli | Payment received (action: "Record payment") |
| Vaada | Promise (action: "Record promise") |
| Sudhaar | Correction |
| Kaccha bill | Draft bill |
| Pakka bill | Final bill |
| Radd | Cancelled |
| Haan ka intezaar | Waiting for yes |
| Bill banao | Review bill |
| Haan, kaat do | Yes, save bill |
| Naya bill | New bill |
| Daba ke bolo | Hold to speak |
| Likho | Add items (focuses the new-line box) |
| Badlo / Hatao / Wapas karo | Change / Remove / Undo |
| Poora cash / Aadha cash / Poora UPI / Sab udhaar | All cash / Half cash / All UPI / All on credit |
| Dukaan | Shop |
| Maal | Items |

Grade 1/2/3, piece, crate, cash, UPI and the name "Bolo" stay as they are.
