# Editable Kaccha Bill Implementation Plan

**Goal:** make the kaccha bill beside the conversation fully editable, with quick payments, undo, a limit bar and
voice-change highlights. **Spec:** `docs/design/2026-11-20-editable-bill-design.md`.

## Global constraints

- Money in whole paise; quick payments use the fresh server preview total only.
- Screens import only `lib/money.ts`, `lib/dates.ts`, `lib/talk.ts`, `lib/draft.ts`, `lib/readback.ts` as values.
- Any edit during AWAITING_CONFIRM returns the bill to DRAFT (existing reducer rule).
- No new libraries; work at 390px with no sideways scroll; respect reduced motion.

## Review focus

1. Undo after a read-back must not let an old "haan" save a changed bill (undo is an edit: back to DRAFT).
2. Quick payment while the preview is stale must do nothing (button disabled).
3. Undo after the bill is saved must do nothing.

### Task 1: Pure helpers in `lib/draft.ts`

**Produces:** `paymentFor(choice: "cash" | "half" | "upi" | "udhaar", total: number): { cash; upi }`;
`changedLines(before: ItemInput[], after: ItemInput[]): number[]`; `limitShare(newOutstanding, limit): number`
(0–100); reducer action `{ type: "revert"; to: BillDraft }` that restores customer, items and payment as a DRAFT
and keeps the draft id.

**Tests (`tests/draft.test.ts`):** aadha cash rounds down to the paisa; changed, added and removed lines are found;
limit share caps at 100 and handles a ₹0 limit; revert returns AWAITING_CONFIRM to DRAFT, keeps the draft id, and
does nothing after SAVED.

### Task 2: The editable slip

**Files:** create `app/_bill/bill-editor.tsx` (editable lines, add-line row, payment with quick buttons, limit bar);
modify `app/_bill/receipt.tsx` (read-only lines only for saved/cancelled; shared totals), `app/_bill/bill-screen.tsx`
(undo stack, voice highlight, phone mini bar, Likho opens the add-line box, drawer removed), `app/globals.css`;
delete `app/_bill/entry-panel.tsx`.

**Verify:** full suite, typecheck, lint, build; headless check of a typed bill then touch edits, no sideways scroll
at 1440 and in a 390px iframe.
