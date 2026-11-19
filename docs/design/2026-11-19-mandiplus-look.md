# Bolo in the MandiPlus look

## Why

Bolo is being built for the MandiPlus × 100X School challenge ("Build MandiPlus Bolo"). The owner wants
Bolo to look like it was made by the MandiPlus team: same logo, colours, type, header, footer and page
style as https://www.mandiplus.com, so a visitor sees one product family.

## Goals

- `/` is a Bolo product page in the mandiplus.com style.
- `/app` is the counter screen (today's `/`), restyled in the same visual language.
- `/help` explains Bolo: voice commands, how to use it, common questions.
- Header and footer match mandiplus.com. Footer links go to the real MandiPlus pages.
- Works at phone width (390px) with no sideways scroll, and on desktop (1440px).

## Non-goals

- No change to billing, voice, ledger or database logic. The 144 tests stay green untouched.
- No login, accounts or new backend routes.
- No new npm libraries. Fonts come through `next/font/google` (already part of Next).

## Anti-goals (a failure even if it looks right)

- Copying MandiPlus text word for word (privacy, terms, refund, support, marketing copy).
- Putting invented facts under the MandiPlus name: prices for Bolo, their support phone or email for
  Bolo, or "owned and operated by ENP FARMS" for this app.
- Copying MandiPlus photos or illustrations.
- Invented numbers, awards, rankings or testimonials for Bolo (their site shows claim totals and
  "#1" badges; Bolo has none). Every feature named on the product page must be true of the current app.
- Breaking the voice flow, the read-back, or the "confirm twice saves once" rule.

## Approaches considered

| Decision | Options | Picked |
| --- | --- | --- |
| Company pages | Link to real mandiplus.com pages · write our own · mix | **Link to real pages** (owner's choice) |
| Page layout | Product site at `/` + app at `/app` · app first at `/` with product page at `/bolo` | **Product site + app** (owner's choice) |
| How to build | Restyle existing components · rewrite the UI | **Restyle** (builder's call): logic is tested; only the look changes |

## Design system (measured from mandiplus.com CSS and screenshots)

| Token | Value | Use |
| --- | --- | --- |
| Brand purple | `#4309AC` | Primary buttons, "Plus" in the wordmark, section labels, links |
| Page background | `#F5F6FB` | All pages |
| Ink | `#111827` | Headings and body text |
| Navy | `#203044` | Secondary dark text |
| Lavender tint | light purple fill | Third-level buttons and soft panels |
| Line | light grey | Dividers between list items, card borders |
| Footer | near-black `#111` | Site footer |

- **Headings:** Bricolage Grotesque, very heavy and tightly spaced (as on mandiplus.com "Risk humara.").
  A second heading line in brand purple, as their site does with a Gujarati line; ours uses Hindi.
- **Body:** Geist.
- **Hindi text** (for example the "बिल कटा" stamp): Noto Sans Devanagari, because Bricolage has no Hindi letters.
- **Section labels:** small, purple, upper-case, wide letter spacing, as on their Products page.
  (This follows the brief: match MandiPlus.)
- **Buttons:** solid purple (main), outlined (second), lavender fill (third). Rounded corners like theirs.
- **Logo:** the text wordmark "Mandi" in ink + "Plus" in purple, in Bricolage, exactly as their header
  shows it. App icon: a purple square with "M+", like their install prompt.

## Pages

### `/` — Bolo product page

```
MandiPlus   Bolo  Help  Products↗              [Bolo kholo]
MANDIPLUS BOLO
Bolo karo.                                    ┌─────────┐
बिल बन जाएगा।          (purple line)           │ phone   │
short line about Bolo                          │ mockup  │
[Bolo kholo]  [Kaise chalta hai]               │ of /app │
                                               └─────────┘
KAISE CHALTA HAI   1 Bolo  ·  2 Bolo padhega  ·  3 Haan, kaat do
BOLKE DEKHIYE      example voice commands in three columns
MANDI KE LIYE BANA list of strengths, three columns with dividers
                   (as on their Products page)
███ black footer ███
```

- The phone mockup is built in HTML and CSS (a small receipt inside a phone frame), not an image.
- "Products↗" goes to https://www.mandiplus.com/products.

### `/app` — counter screen

- Same behaviour as today's `/`.
- Thin top bar in the MandiPlus app style: wordmark, "Bolo", and a link back to `/`.
- Panels, receipt, chat bubbles, mic button and Likho sheet recoloured to the tokens above:
  white cards, light borders, purple primary actions, flat purple mic with its loudness halo.
- No big site footer here (it is a work screen).

### `/help` — Bolo help

- Heading in site style.
- Voice command groups: bill, payment, corrections, questions (customer balance, today's sale).
- Questions people will ask: mic permission, why https is needed on a phone, what happens on a wrong
  name, how confirm works, offline fallback.
- Site footer.

### Footer (on `/` and `/help`)

- Wordmark and one short line in our own words.
- Link row, each to the real page on mandiplus.com, opening in a new tab:
  Products `/products`, Service charges `/pricing`, Support `/support`,
  Privacy `/privacy-policy`, Terms `/terms-and-conditions`.
- No company address, phone or ownership block.

## Constraints from this codebase

- Next.js 16 with Cache Components: no random values or `Date.now()` during render; DB reads in GET
  routes call `await connection()`.
- Mobile grids use `grid-cols-1` / `minmax(0,1fr)` so inputs cannot push the page wider than a phone.
- The mic needs https or localhost.
- README and CLAUDE.md say the app is at `/`; both must point to `/app` after the move.

## How it will be checked

- `npm test` (144), `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Headless Chrome screenshots of `/`, `/app`, `/help` at 1440px and 390px, compared side by side with
  the mandiplus.com screenshots.
- At 390px, page width equals screen width on every page.
- Every footer link points to a mandiplus.com URL that returns HTTP 200.
- A voice-free run of the counter (type a command in the composer, confirm) still saves exactly one bill.

## Left to the builder

- Exact wording of headings and help text (Hinglish, short, in our own words).
- Order of the product-page sections after the hero.
- Icon choice for the strength list (simple line icons, like their Products page).
