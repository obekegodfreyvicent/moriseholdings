# Morise banner system — shared building blocks

Every file in this folder is a standalone SVG (no external refs, no web
fonts — a system sans stack in `<text>`). They share one visual language:

- **Ground:** navy → blue diagonal gradient (`#16283F → #1E3A5F → #2E5395`).
- **Watermark:** the Morise logomark "M" path, white at 6–10 % opacity,
  oversized and bled off an edge.
- **Keystone:** the amber apex diamond (`#D97706`) as the single accent.
- **Route motif:** a thin white/amber polyline through small nodes —
  "every input, every mile, every store".
- **Type:** 800-weight wordmark, 600-weight strapline, letter-spaced
  eyebrow — mirrors `../morise-logo.svg`.

Font stack used verbatim in every `<text>`:
`Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

## Inventory

| File | Size | Text baked? | Use |
|------|------|-------------|-----|
| `group-hero.svg` | 1600×520 | yes | Standalone group hero / share / print |
| `group-hero-bg.svg` | 1600×520 | no | CSS background behind live HTML hero copy (`.mc-hero`, `.sf-hero`) |
| `page-header-bg.svg` | 1600×200 | no | Slim interior-page header band |
| `social-card.svg` | 1200×630 | yes | Open Graph / Twitter / LinkedIn share card |
| `email-header.svg` | 1200×280 | yes | Newsletter / transactional-email header |
| `promo-strip.svg` | 1600×200 | yes | Storefront promotional strip |
| `announcement-ribbon.svg` | 1600×56 | yes | Thin top-of-page notice ("Demonstration build") |
| `auth-side.svg` | 960×1200 | yes | Brand panel beside the sign-in / register forms |
| `subsidiary-agro.svg` | 1600×420 | yes | Morise Agro Ltd — agricultural inputs & fuel |
| `subsidiary-logistics.svg` | 1600×420 | yes | Morise Logistics Ltd — freight & haulage |
| `subsidiary-clearing-forwarding.svg` | 1600×420 | yes | Morise Clearing & Forwarding Ltd |
| `subsidiary-warehouse.svg` | 1600×420 | yes | Morise Warehouse Management Ltd |
| `subsidiary-collateral.svg` | 1600×420 | yes | Morise Collateral Management Ltd |

Colours are the brand tokens — see `../README.md`. Per-subsidiary banners
keep the navy ground and amber diamond and add one sector-accent hue for
the route motif only.
