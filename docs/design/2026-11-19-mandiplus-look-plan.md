# Bolo in the MandiPlus look — implementation plan

**Goal:** `/` Bolo product page, `/app` counter, `/help` help page, all in the mandiplus.com visual language.

**Architecture:** A small `app/_site/` folder holds shared site pieces (links, wordmark, header, footer,
phone mockup). The counter keeps every component in `app/_bill/`; only its page moves and its CSS
changes. Billing, voice and database code are not touched.

**Tech stack:** Next.js 16 App Router, Tailwind 4 + `app/globals.css`, `next/font/google`. No new npm packages.

**Spec:** `docs/design/2026-11-19-mandiplus-look.md`

## Global constraints

- Brand purple `#4309AC`; page background `#F5F6FB`; ink `#111827`; navy `#203044`; footer near-black `#111`.
- Fonts: Bricolage Grotesque (headings), Geist (body), Noto Sans Devanagari (Hindi).
- Footer links (new tab, `rel="noopener noreferrer"`), in this order:
  Products `https://www.mandiplus.com/products`, Service charges `https://www.mandiplus.com/pricing`,
  Support `https://www.mandiplus.com/support`, Privacy `https://www.mandiplus.com/privacy-policy`,
  Terms `https://www.mandiplus.com/terms-and-conditions`.
- No copied MandiPlus text, images, prices, contacts or ownership block. No invented numbers, awards or testimonials.
- No `new Date()`, `Date.now()` or random values during render (Cache Components fails the build).
- Mobile layouts use `grid-cols-1` / `minmax(0,1fr)`; no page wider than 390px at 390px.
- Keep existing token names (`coconut`, `canvas`, `ink`, `line`, `muted`) so `app/_bill/*` keeps working;
  only their values change. `coconut` becomes the brand purple.

## Review focus

1. Phone width: a new section overflowing at 390px. Checked by measuring scrollWidth on every page.
2. The counter at `/app` must still save exactly one bill on confirm. Checked with a typed command run.
3. Footer links must reach real pages. Checked with an HTTP 200 test against each URL.
4. Hindi text (stamp, read-back lines) must render in Noto Sans Devanagari, not a fallback box font.
5. Reduced motion: no new animation on the site pages beyond hover colour changes.

---

### Task 1: Brand foundation (links, fonts, tokens, wordmark, header, footer)

**Files:**
- Create: `app/_site/links.ts`, `app/_site/wordmark.tsx`, `app/_site/site-header.tsx`, `app/_site/site-footer.tsx`
- Modify: `app/layout.tsx` (fonts), `app/globals.css` (tokens)
- Test: `tests/site-links.test.ts`

**Interfaces (produces):**
- `FOOTER_LINKS: readonly { label: string; href: string }[]` and `MANDIPLUS_PRODUCTS: string` in `links.ts`
- `<Wordmark className? />` — "Mandi" ink + "Plus" purple, Bricolage
- `<SiteHeader />` — wordmark, nav Bolo (`/`), Help (`/help`), Products (external), purple button "Bolo kholo" (`/app`); phone: menu button that shows the same links
- `<SiteFooter />` — black footer, wordmark, one own-words line, `FOOTER_LINKS` row
- CSS variables `--font-display`, `--font-body`, `--font-hindi`

- [ ] Write `tests/site-links.test.ts`: labels equal `["Products","Service charges","Support","Privacy","Terms"]`; every href matches `^https://www\.mandiplus\.com/`.
- [ ] Run `npx vitest run tests/site-links.test.ts` → FAIL (module missing).
- [ ] Create `links.ts` with the constants from Global constraints.
- [ ] Run the test → PASS.
- [ ] Fonts in `layout.tsx` via `Bricolage_Grotesque`, `Geist`, `Noto_Sans_Devanagari`; tokens in `globals.css`.
- [ ] Create wordmark, header, footer.
- [ ] `npm run typecheck && npm run lint` → clean.

### Task 2: Counter moves to `/app` and takes the new look

**Files:**
- Create: `app/app/page.tsx` (renders `<AppBar />` + `<BillScreen rates={...} />`), `app/_site/app-bar.tsx`
- Modify: `app/globals.css` (workspace, panels, orb, composer, receipt, sheet colours to the tokens)

- [ ] Move the counter render from `app/page.tsx` to `app/app/page.tsx`; title "Bolo · MandiPlus".
- [ ] `AppBar`: wordmark + "Bolo" label + "Help" link + link back to `/`.
- [ ] Restyle workspace classes: white cards with light borders, no radial gradients, flat purple mic with halo, purple primary buttons; keep all class names.
- [ ] `npm test` → 144 + site-links pass; `npm run build` passes.

### Task 3: Product page at `/`

**Files:**
- Modify: `app/page.tsx`
- Create: `app/_site/phone-mockup.tsx`

- [ ] Hero: purple upper-case label, heading "Bolo karo." + purple Hindi line, short line, buttons "Bolo kholo" (`/app`) and "Kaise chalta hai" (`/help`), phone mockup on the right (stacks below on phone).
- [ ] Sections: three steps; voice examples (taken from README commands that work today); strengths list in three columns with dividers (only features the app has today).
- [ ] `<SiteHeader />` and `<SiteFooter />`.

### Task 4: Help page at `/help`

**Files:** Create `app/help/page.tsx`

- [ ] Heading block in site style; command groups (bill, payment, corrections, questions) with examples that the parser handles today; questions: mic permission, https on phone, wrong name, confirm, offline fallback; header + footer.

### Task 5: Icon, docs

**Files:** `app/icon.png`, `app/apple-icon.png`, `README.md`, `CLAUDE.md`

- [ ] Purple `#4309AC` square with white "M+" (192px and 180px).
- [ ] README and CLAUDE.md: the counter is at `/app`; mention `/` and `/help`.

### Task 6: Verify

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- [ ] Headless screenshots of `/`, `/app`, `/help` at 1440px and 390px; compare with the mandiplus.com shots.
- [ ] scrollWidth equals viewport width at 390px on all three pages.
- [ ] Each `FOOTER_LINKS` href returns HTTP 200.
- [ ] Typed "Manat ko 10 piece grade 1, 4 hazaar cash" then confirm twice → exactly one new bill row.
- [ ] One-line commits per task, `sync` after each.
