# Editable kaccha bill beside the conversation

**Why:** at the counter the owner talks to Bolo and fixes the bill by touch in the same moment. Today the bill on
the right is read-only and touch editing hides in the Likho drawer, which covers the screen. The owner asked for the
kaccha bill as a sidebar where everything can be edited, "super advanced and useful".

## Approaches

| | Approach | Trade-off |
| --- | --- | --- |
| **A (chosen)** | Edit in place on the kaccha slip | one place for voice and touch; most work |
| B | Read-only slip plus a permanent Likho form under it | quick, but the bill shows twice |
| C | An "Edit bill" pop-up | simple, but it hides the conversation |

## Design (approved)

- **Lines on the slip are editable:** grade chips 1/2/3, a −/+ stepper you can also type into, piece/crate,
  a tap-to-change rate marked "badla" with a one-tap way back to the list price, and remove.
- **Add a line** from the slip: a quantity box and "+ Grade 1/2/3" buttons.
- **Payment on the slip:** cash and UPI boxes plus quick buttons "Poora cash", "Aadha cash", "Poora UPI",
  "Sab udhaar". Amounts come from the server preview's total; the screen does no money maths.
- **Limit bar:** the new udhaar against the credit limit, coloured ok / near / over.
- **Undo** the last touch or voice change while the bill is kaccha.
- **A line that voice just changed lights up** for a moment (no motion when reduced motion is on).
- **Phone:** the Bill view is the same editable slip; the chat shows a small "Vikas · 1 maal · ₹12,000" bar that
  opens it. The Likho drawer goes away; the Likho button opens the slip's add-line box.
- Saved and cancelled bills stay read-only (pakka / radd).

## Rules that do not change

Money in whole paise; any edit after the read-back sends the bill back to Kaccha and needs a new read-back;
nothing saves without "haan" or the button; no new libraries; no server changes.

## Left to the builder

Exact spacing, the limit bar's look within the brand tokens, keyboard order.
