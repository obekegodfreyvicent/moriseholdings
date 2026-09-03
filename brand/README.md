# Morise — Brand Mark

A single, professional identity for **Morise Holdings Limited** and every
subsidiary in the group (Agro, Logistics, Clearing & Forwarding, Warehouse
Management, Collateral Management).

## The mark

A geometric **monoline “M”** that also reads as an **upward growth line** and as a
**route/path between points** — the group moves goods, inputs, fuel and value
across sites. Resting on its apex is an **amber diamond**: the holding company as
the **connecting keystone** of its subsidiaries and the group’s guiding value.

The “M” is one continuous stroke with round caps and joins, so it stays crisp
from a 16 px favicon to a signboard.

## Colour

| Role            | Hex        | Use                                                    |
|-----------------|------------|--------------------------------------------------------|
| Morise Navy     | `#1E3A5F`  | App tile, wordmark, primary UI (`--navy` / `--sf-navy` / `--mc-navy`) |
| Morise Amber    | `#D97706`  | Apex diamond, accents only (`--sf-accent` / `--mc-accent`) |
| White           | `#FFFFFF`  | The “M” on navy; knockout lockups                      |
| Slate (subtitle)| `#64748B`  | “HOLDINGS LIMITED” subtitle in the full lockup         |

The “M” stroke is **navy on light** backgrounds and **white on navy/dark**
backgrounds. The diamond is **always amber**.

## Files

| File | What it is | Where to use |
|------|-----------|--------------|
| `morise-logo.svg`            | Primary lockup: navy tile mark + `MORISE` wordmark + `HOLDINGS LIMITED` subtitle | Documents, slide masters, letterhead, README header |
| `morise-logomark.svg`        | App-tile mark: navy rounded square, white “M”, amber diamond | Favicons, app icons, splash, avatars |
| `morise-logomark-light.svg`  | Mark only, **white** “M” + amber diamond, transparent | On navy / photography / dark UI |
| `morise-logomark-dark.svg`   | Mark only, **navy** “M” + amber diamond, transparent | On white / light UI |

### In the apps

Both React apps render the mark from one component — `src/components/Logo.jsx`
(identical in `mbms/frontend` and `mbms/storefront`):

```jsx
import Logo from './components/Logo';

<Logo size={22} />            {/* “M” inherits currentColor of its badge */}
<Logo size={64} tile />       {/* standalone navy app-tile */}
<Logo size={40} tone="#1E3A5F" />
```

The “M” stroke uses `currentColor`, so a `<Logo/>` dropped inside an existing
badge (`.mark`, `.lmark`, `.sf-brand-mark`, `.sf-login-mark`, `.mc-wordmark-mark`)
automatically takes navy-on-white or white-on-navy from that badge’s own colour.
Favicons are inline SVG `data:` URIs in each app’s `index.html`.

## Clear space & minimum size

- **Clear space:** keep a margin of half the tile’s width on all sides.
- **Minimum:** 16 px for the mark; 96 px wide for the full lockup (below that,
  drop the “HOLDINGS LIMITED” subtitle, then the wordmark).

## Do / Don’t

**Do** — use the supplied SVGs · keep navy + amber exact · put the white “M” on
navy or dark photography · let the mark inherit `currentColor` in-app.

**Don’t** — recolour the diamond · rotate, skew or add effects (shadow, gradient,
outline) · stretch non-proportionally · re-draw the “M” with a different weight ·
place the navy “M” on a busy or dark background · box the transparent
light/dark marks in a coloured tile that isn’t navy.

---

# Banners — `brand/banners/`

A banner family on the same visual language: navy → blue diagonal
gradient (`#16283F → #1E3A5F → #2E5395`), the logomark “M” as an
oversized white watermark at 6–10 % opacity, the amber keystone diamond
(`#D97706`) as the single accent, and a thin white/amber **route line**
through small nodes — "every input, every mile, every store".

Every file is a **standalone SVG** — no external fonts (a system sans
stack in `<text>`), no external refs — so each works as a file, an
`<img>`, or a CSS `background-image`.

| File | Size | Text baked? | Use |
|------|------|-------------|-----|
| `group-hero.svg` | 1600×520 | yes | Standalone group hero — share, print, slide |
| `group-hero-bg.svg` | 1600×520 | no | Texture **behind** live HTML hero copy (`.mc-hero`, `.sf-hero`) |
| `page-header-bg.svg` | 1600×200 | no | Slim interior-page header band |
| `social-card.svg` | 1200×630 | yes | Open Graph / Twitter / LinkedIn share card |
| `email-header.svg` | 1200×280 | yes | Newsletter / transactional-email header |
| `promo-strip.svg` | 1600×200 | yes | Storefront promotional strip |
| `announcement-ribbon.svg` | 1600×56 | yes | Thin top-of-page notice ("Demonstration build") |
| `auth-side.svg` | 960×1200 | yes | Brand panel beside the sign-in / register forms |
| `subsidiary-agro.svg` | 1600×420 | yes | Morise Agro Ltd — agricultural inputs & fuel (green accent) |
| `subsidiary-logistics.svg` | 1600×420 | yes | Morise Logistics Ltd — freight & haulage (sky accent) |
| `subsidiary-clearing-forwarding.svg` | 1600×420 | yes | Morise Clearing & Forwarding Ltd (violet accent) |
| `subsidiary-warehouse.svg` | 1600×420 | yes | Morise Warehouse Management Ltd (teal accent) |
| `subsidiary-collateral.svg` | 1600×420 | yes | Morise Collateral Management Ltd (rose accent) |
| `subsidiary-milling.svg` | 1600×420 | yes | Morise Milling Ltd — grain milling (amber accent; grinding-wheel + grain motif) |

Per-subsidiary banners keep the navy ground and amber diamond and add
**one** sector-accent hue — on the route line only.

## In the apps

The SVGs are mirrored into `mbms/frontend/public/brand/banners/` and
`mbms/storefront/public/brand/banners/`, so a page references them as
`/brand/banners/<name>.svg`. Wired in so far:

- `.sf-hero` and `.mc-hero` layer `group-hero-bg.svg` over their navy→blue
  gradient (the gradient stays as a fallback).
- Both `index.html` files set `og:image` / `twitter:image` to
  `social-card.svg`.
- **Displayed on the storefront** via `bannerFor(name)` in
  `mbms/storefront/src/lib/corporate.js` (subsidiary → its
  `subsidiary-*.svg`, group hero as fallback): the landing-page Companies
  grid, the Companies directory and each portfolio-company page show the
  subsidiary banner; the subsidiary directory shows the group hero +
  per-card banners; the shop shows `promo-strip.svg` (or the filtered
  subsidiary's banner).

Keep the two `public/brand/banners/` copies in sync with
`brand/banners/`, and keep the banner visual language aligned with the
logo above.
