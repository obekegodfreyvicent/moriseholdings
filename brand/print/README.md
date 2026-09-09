# Morise — Print collateral

Print-ready marketing pieces for **Morise Holdings Limited**, built on the
group brand system in [`../README.md`](../README.md): Morise Navy `#1E3A5F`,
Morise Amber `#D97706`, the monoline **“M”** + amber keystone diamond, and the
navy → blue field used on the app heroes and banners.

Each piece is a **single self-contained HTML file** that renders to exact print
dimensions. Fonts (Inter, latin) are embedded in `_brand.css` as base64
`@font-face`, so the files print identically offline.

| File | Piece | Size | Pages |
|------|-------|------|-------|
| `business-cards.html` | Director business cards, front + back | 85 × 55 mm | 12 (6 cards × 2 sides) |
| `flyer.html` | Group capability flyer | A4 portrait, full-bleed | 1 |
| `brochure.html` | Group profile brochure, tri-fold | A4 landscape, 2 sheets | 2 |
| `_brand.css` | Shared palette, type, logo + motif components | — | — |

Rendered PDFs (`business-cards.pdf`, `flyer.pdf`, `brochure.pdf`) and PNG
previews (`previews/`) are checked in beside the source.

## Before you send anything to print

- **Phone numbers are placeholders.** Replace every `+256 (0)0 000 0000` with a
  real line. Email addresses (`f.lastname@morise-holdings.com`), the web
  address (`morise-holdings.com`) and the registered office (Kira, Mulawa,
  Wakiso District) are the real group values from the system seed — confirm the
  web / `hello@` address exists before publishing.
- The **six directors** on the cards are the seeded group leadership personas
  (Okurut Mathias, Obeke Godfrey, Alan Smith, Mary Nakato, Susan Nassuna) plus
  one **blank template** card. Add or swap directors by copying a `.pair`
  block in `business-cards.html`.
- Colours are RGB. A commercial printer will want **CMYK / spot** — give them
  the hex values above (Navy `#1E3A5F`, Amber `#D97706`) to match.

## Regenerate the PDFs

```bash
cd brand/print
CHROME=/snap/bin/chromium        # or: google-chrome / chromium-browser
for f in business-cards flyer brochure; do
  "$CHROME" --headless --no-sandbox --disable-gpu \
    --no-pdf-header-footer --print-to-pdf-no-header \
    --print-to-pdf="$f.pdf" "file://$PWD/$f.html"
done
```

Or just open a file in a browser and **Print → Save as PDF** with margins set
to *None* and “Background graphics” **on**.

## Business cards

`85 × 55 mm` (ISO / the common size in Uganda and Europe). Each card prints as
its own page — **front, then back, then the next director**. Backgrounds run
full-bleed so a short office run needs no crop marks; a print shop can impose
several up from the same PDF and add 3 mm bleed. Keep all text inside the
existing safe area if you edit.

- **Front** — navy field, white “M” tile, name, role in amber, phone / email /
  web, and a footer rule with the entity and registered city.
- **Back** — the full `MORISE / HOLDINGS LIMITED` lockup, the group line
  *“Every input. Every mile. Every store.”*, and the six subsidiaries as
  accent-dot chips.

## Flyer

A4 portrait, one page, full-bleed. Navy hero (headline + positioning line and
the route-line motif), a 2 × 3 grid of the six operating companies with sector,
one-liner and head-office city, a four-point “why Morise” strip, and a navy
footer with the contact block and a “capability pack” call to action.

## Brochure

A4 landscape **letter tri-fold** (two outward folds). Two sheets:

- **Sheet 1 — OUTSIDE** (prints on the front of the paper), panels left → right:
  **inner flap** (*“At a glance”* — 6 / 1 / 7+ and the activity list) ·
  **back cover** (blurb, the six companies, contact block) ·
  **front cover** (navy, lockup, *“One group across the whole supply chain.”*).
- **Sheet 2 — INSIDE** (prints on the back — flip on the **short edge**),
  panels left → right: **who we are** · **companies 1–3** · **companies 4–6**
  with the *“One platform.”* close.

Fold: the left third folds in first, then the front-cover third folds over it.
The dashed guides on screen (99 mm / 198 mm) mark the folds and do not print.
For a production run, ask the printer to shave ~1 mm off the panel that tucks
inside.
