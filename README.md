# Morise Holdings Limited — Business Management System (repository root)

This directory holds everything for the **Morise Holdings Limited Business
Management System (MBMS)** proof-of-concept:

| Path | What it is |
|------|------------|
| `mbms/` | The running system — NestJS/Fastify + Prisma backend, a staff **Admin** React app, and a **Customer Storefront** React app. Has its own detailed `mbms/README.md` with a per-sprint build log. |
| `docx/` | The companion documentation set — 22 numbered documents (Project Proposal → UI-UX Design; 19 = Clearing & Forwarding spec, 20 = Warehouse Management spec, 21 = Multi-Site Collateral Management spec, 22 = Delivery Management System spec), plus `morise.docx`, `Multi_Holdings_Limited_Software_Development_Procedures.docx`, the raw client attachments (`cf.docx`, `WMS_Features_Uganda_Multi_Branch.docx`, `Multi-Site-Collateral-Management-System-Feature-Specification.docx`, `Delivery-Software-Feature-Specification.docx`), and dated backups in `docx_backup*/`. |
| `screenshots/` | Reference screenshots. `Administrator/` and `Customer/` are the mockup/verification sets; the four `Screenshot From 2026-08-27 *.png` files are the **admin navigation redesign** reference (below). |

---

## Admin navigation redesign (27 August 2026)

The staff Admin app (`mbms/frontend`) previously had a **flat sidebar of 21
links**. It is now organised into **four collapsible categories** matching the
agreed screen taxonomy in the four `Screenshot From 2026-08-27 *.png`
reference images. Category headers expand/collapse on click; the open/closed
state is remembered per browser (`localStorage` key `mbms.nav.open`), and the
category that owns the current route is always expanded.

Every previously working page is still present — it has only been regrouped
and, in some cases, relabelled. Menu entries that are part of the taxonomy but
have **no backend service in the current slice** are marked with a `soon`
pill and route to a consistent **"Planned"** placeholder screen
(`mbms/frontend/src/components/ComingSoon.jsx`) so the structure has no dead
links.

### 1. Admin / Backend

| Menu item | Route | Status |
|-----------|-------|--------|
| Dashboard | `/dashboard` | **Working** (group / subsidiary dashboards) |
| Companies & Holdings | `/companies` | **Working** (was "Companies") |
| Product Manager | `/products` | **Working** (was "Products") |
| Order Management | `/orders` | **Working** (was "Orders") |
| Inventory | `/inventory` | **Working** (activated 28 August 2026 — company-level stock, re-order points, adjustments, movement ledger) |
| Customers (CRM) | `/customers` | **Working** (was "Customers") |
| Support Tickets | `/support-tickets` | **Working** |
| Marketing & Promos | `/marketing` | **Working** (activated 28 August 2026 — discount codes + promo banners, consumed by the storefront) |
| CMS / Site Builder | `/cms` | **Working** (activated 28 August 2026 — draft/publish content pages served at storefront `/page/:slug`) |
| Users & Settings | `/users` | **Working** (was "Users & Roles") |
| Activity Log | `/audit` | **Working** (was "Audit Trail") |

### 2. Human Resources

| Menu item | Route | Status |
|-----------|-------|--------|
| HR Dashboard | `/hr` | **Working** (activated 28 August 2026 — headcount / attendance / recruitment / upcoming-events roll-up, read-only) |
| Employees | `/employees` | **Working** |
| Departments | `/departments` | **Working** (activated 28 August 2026 — list across companies with headcount; create / rename / delete) |
| Attendance | `/attendance` | **Working** |
| Leave Requests | `/leave` | **Working** (was "Leave") |
| Shift Scheduling | `/shift-scheduling` | **Working** (activated 28 August 2026 — weekly roster builder, publish + notify, coverage & clash view) |
| Recruitment | `/recruitment` | **Working** |
| Payroll | `/payroll` | **Working** (activated 28 August 2026 — monthly run with Uganda PAYE/NSSF, payslips, salary advances, GL posting) |

### 3. My HR (employee self-service)

| Menu item | Route | Status |
|-----------|-------|--------|
| My Profile | `/profile` | **Working** |
| Clock In / Out | `/my/clock` | **Working** (activated 28 August 2026) |
| My Leave | `/my/leave` | **Working** (28 August 2026 — balances, apply, cancel) |
| My Shifts | `/my/shifts` | **Working** (28 August 2026 — my published + planned roster) |
| My Performance | `/my/performance` | **Working** (28 August 2026 — reviews, objectives, self-assessment) |
| My Payslips | `/my/payslips` | **Working** (28 August 2026 — payslips from paid runs) |
| My Salary Advances | `/my/salary-advances` | **Working** (28 August 2026 — view + self-request) |

All six require only a login **linked to an employee record** (`Employee.userId`) — no permission.

### 4. Financial & Accounting

| Menu item | Route | Status |
|-----------|-------|--------|
| Financial & Accounting | `/finance` | **Working** (activated 28 August 2026 — group position + needs-attention + period-close overview, read-only) |
| General Ledger & Journals | `/accounting` | **Working** (was "Accounting") |
| Accounts Payable | `/accounts-payable` | **Working** |
| Expenses | `/expenses` | **Working** |
| Assets | `/assets` | **Working** |
| Projects | `/projects` | **Working** |
| Reports | `/reports` | **Working** |
| Suppliers | `/suppliers` | **Working** (moved here from the old flat list) |
| Inter-Company | `/inter-company` | **Working** |

> **Deviations from the four screenshots, and why.** The screenshots show
> the four category *headers* and only some leaf items. Existing working
> pages that no screenshot places in a category — Suppliers, Companies &
> Holdings, and the finance sub-screens (GL, AP, Expenses, Assets, Projects,
> Reports, Inter-Company) — were kept reachable rather than hidden:
> Companies & Holdings sits under **Admin / Backend**, and the finance
> sub-screens plus Suppliers sit under **Financial & Accounting** beneath
> the "Financial & Accounting" overview entry. "Performance" is no longer a
> top-level admin link; manager-side performance stays reachable via
> Recruitment/HR flows and `/performance`, and **My Performance** is the
> self-service entry.

### Files touched

```
mbms/frontend/src/components/Layout.jsx      # NAV_GROUPS taxonomy + collapsible category UI
mbms/frontend/src/components/ComingSoon.jsx   # new — shared "Planned" placeholder
mbms/frontend/src/App.jsx                     # STUB_ROUTES for the 14 planned screens
mbms/frontend/src/styles/app.css             # .navgroup-header / .navitem-soon styles
```

Verified with `vite build` (62 modules, no errors) and a headless screenshot
of the running dev server (`screenshots/Administrator/17-nav-redesign-categories.png`).

---

## Managing Director — full operational authority (30 August 2026)

The **Managing Director** role now holds the **complete permission catalogue
— all 53 codes** (the same breadth as Super Administrator, plus
`identity.user.delegate`), so the MD can **view, create, edit, approve and
execute** on every section of the four admin categories — **ADMIN /
BACKEND, HUMAN RESOURCES, MY HR, FINANCIAL & ACCOUNTING** — not only hold
group-wide *view*. `MY HR` needs no permission (it is scoped by the
signed-in user's own employee record).

- **Backend** — `ROLE_PERMISSIONS['Managing Director']` in
  `mbms/backend/prisma/seed.ts` expanded from a mostly-`viewAll` set to the
  full catalogue; it gains the `manage` / `approve` / `view.sensitive`
  codes it lacked (employee, accounting, customer, supplier, product,
  asset, recruitment, attendance, leave (+approve), performance, payroll,
  sales.order, support.ticket, ap, expense.approve.manager/finance).
- **Frontend** — 16 admin pages whose in-screen *manage / approve /
  create* controls were gated by a hard-coded **role list only**
  (Accounting, Accounts Payable, Assets, Attendance, Customers, Employees,
  Expenses, Inter-Company, Leave, Order Management, Performance, Product
  Manager, Projects, Recruitment, Suppliers, Support Tickets) now also
  accept the matching **permission code** —
  `hasRole(…) || hasPermission('…')`. This unlocks every control for the MD
  **and** for any role/user granted that permission through delegated
  administration; the newer screens (CMS, Departments, Inventory,
  Marketing, Payroll, Shift Scheduling) already worked this way.
- **No new permission code, endpoint, schema or migration** — the API
  already enforced these codes per route; only the seeded grants and the
  front-end control visibility changed.

**Verified**: signed in as the MD, `GET /identity/auth/me` → all 53 codes;
a read in every section of all four categories → `200` (no `403`); write
(`manage`) calls across the modules are accepted or fail only on payload
validation (`VALIDATION_ERROR`), never on permission.

---

## Delegated administration — who may grant what (27 August 2026)

**Every admin user may only view, create, update, delete and execute the
operations that have been granted to them.** This was already enforced
per-request by the permission guard (`@RequirePermission` + `PermissionsGuard`
re-deriving roles/permissions from the database on every call). What changed
on 27 August 2026 is **who may make those grants, and how far their authority
reaches.**

Roles and direct permissions can now only be granted or revoked by three
business grantor roles, each bounded:

| Grantor | May delegate | To which users |
|---------|--------------|----------------|
| **Managing Director** | any role, any permission (every domain) | any user, group-wide |
| **Branch Manager** | only `operations`-domain permissions (and roles made only of them) | only users inside their own company/branch scope |
| **Human Resources Manager** | only `hr`-domain permissions | only users inside their own company/branch scope |

*Super Administrator / IT Administrator* keep unbounded grant authority as the
platform bootstrap / break-glass path (they hold `identity.user.manage`).

### How it works

- Every `Permission` row carries a **`domain`**: `identity`, `org`, `hr`,
  `finance`, `operations` or `governance` (Prisma column, backfilled by the
  seed).
- `DELEGATION_RULES` (`mbms/backend/src/identity/delegation/delegation.rules.ts`)
  maps each grantor role to the domains it may delegate and whether its
  authority is `group` or `own-scope`. A user with several grantor roles gets
  the union.
- `DelegationService.assertCanGrant(actor, targetUserId, permissionCodes)`
  runs on **every** grant/revoke (role assignment expands to its permission
  codes first): it checks the domain of each permission against the actor's
  authority, then — for `own-scope` grantors — that every one of the target
  user's `UserScope` rows is covered by one of the actor's.
- A new permission **`identity.user.delegate`** lets the three grantor roles
  reach the grant/revoke and (read-only) user-list endpoints; user lifecycle
  (create / activate / lock / scope) stays `identity.user.manage`-only.
- `GET /identity/users/:id/delegatable-grants` returns exactly the roles and
  permissions the signed-in admin may grant on that user, plus
  `canDelegateToTarget`. The **Users & Settings** screen uses it so its
  dropdowns only ever offer allowed grants, and shows a notice when the
  selected user is outside the admin's delegation scope.
- Grant and revoke are both written to the audit trail
  (`identity.user.updated` with `roleAssigned` / `roleRemoved` /
  `permissionGranted` / `permissionRevoked`); a blocked attempt is recorded by
  the guard as `UsersController.access.denied`.

### Files touched

```
mbms/backend/prisma/schema.prisma                          # Permission.domain
mbms/backend/prisma/migrations/*_delegation_permission_domain
mbms/backend/src/identity/delegation/delegation.rules.ts    # new — DELEGATION_RULES
mbms/backend/src/identity/delegation/delegation.service.ts  # new — assertCanGrant / listDelegatable
mbms/backend/src/identity/users/users.service.ts            # enforce on add/remove role & permission
mbms/backend/src/identity/users/users.controller.ts         # identity.user.delegate, delegatable-grants route
mbms/backend/src/identity/users/users.module.ts             # provide DelegationService
mbms/backend/prisma/seed.ts                                 # per-permission domain; grant identity.user.delegate to MD / Branch Mgr / HR Mgr / Super Admin
mbms/frontend/src/pages/Users.jsx                           # per-user delegatable-grants, scope notice, lifecycle gated to platform admins
```

Verified end-to-end with the running API: MD grants any domain; Branch Manager
grants `operations` in-scope (201) but is refused an `hr` permission and any
out-of-scope target (403); HR Manager grants `hr` in-scope (201) but is
refused `operations` (403); a non-grantor is refused by the guard (403).
Screenshot: `screenshots/Administrator/18-rbac-delegated-grants-branch-manager.png`.

### Hiding what isn't granted (27 August 2026)

An admin user who has **not** been granted an operation now **does not see it
at all** — the sidebar item is not rendered (not shown greyed, not shown
disabled), the whole category disappears when none of its items are visible,
and typing the URL redirects to the dashboard. The dashboard and the *My HR*
self-service screens are always visible; holders of `identity.user.manage`
(Super Administrator / IT Administrator) see everything.

How it works:

- The login / refresh response and `GET /identity/users/me` now include the
  user's **effective permission codes** (role permissions + direct grants) —
  the same set the JWT strategy re-derives per request and the guard enforces.
- `mbms/frontend/src/lib/capabilities.js` maps every admin route to the
  permission code(s) that make it meaningful (`ROUTE_CAPABILITIES`), with
  `'*'` for always-visible routes and `'__platform_admin__'` for planned
  screens that have no permission code yet (Payroll). One map drives both nav
  filtering and the route guard, so they cannot drift.
- `Layout.jsx` filters `NAV_GROUPS` through `canSeeRoute()`; `RequireAuth`
  calls `canSeeCurrentPath()` and `<Navigate to="/dashboard">` when the user
  may not see the target. `useAuth().hasPermission(...codes)` is available to
  screens for finer-grained hiding.
- While a session stored before this field existed is being re-hydrated
  (`AuthProvider` re-fetches `/identity/users/me` on load), nothing is
  blocked client-side — the API still enforces every call.

Files touched:

```
mbms/backend/src/identity/auth/auth.service.ts     # effective `permissions` in login/refresh user payload
mbms/backend/src/identity/users/users.service.ts   # effective `permissions` in /identity/users/me
mbms/frontend/src/lib/capabilities.js              # new — ROUTE_CAPABILITIES + canSeeRoute / canSeeCurrentPath
mbms/frontend/src/lib/auth.jsx                     # hasPermission(); re-hydrate permissions on load
mbms/frontend/src/components/RequireAuth.jsx       # redirect to /dashboard for an unpermitted route
mbms/frontend/src/components/Layout.jsx            # hide nav items / empty categories
```

Verified: as **Sales Manager** (holds `product.manage`, `sales.order.manage`,
`customer.manage`, `marketing.manage` / `marketing.viewAll`, `expense.create`,
`expense.approve.manager`, `leave.approve`) the sidebar shows only Dashboard,
Product Manager, Order Management, Inventory, Customers (CRM), Marketing &
Promos, Leave Requests, all of *My HR*, and Expenses — **not** CMS / Site
Builder (needs `cms.*`) and nothing else; navigating to `/users` redirects to
the dashboard. Screenshot:
`screenshots/Administrator/19-rbac-visibility-restricted-nav.png`.

---

## Customer storefront localisation (27 August 2026)

A customer can switch the **Customer Storefront** (`mbms/storefront`) into a
wide range of languages from a picker in the header (and on the Landing and
Login screens, before sign-in). The choice is remembered per browser
(`localStorage` key `storefront.lang`), sets `<html lang>`, and — for
right-to-left scripts (Arabic) — flips `<html dir>`.

Delivered in three same-day steps: first **Uganda's languages**, then the
**major languages of every continent**, then a **full-coverage pass** so that
choosing a translated language changes **every screen of the storefront**, not
just the navigation and headings.

- **Languages offered** — **43** in total, grouped in the picker:
  - *Uganda — Official / Global*: English, Swahili.
  - *Uganda — Bantu*: Luganda, Runyankole, Rukiga, Lusoga, Rutooro, Lumasaba, Kinyarwanda.
  - *Uganda — Nilotic*: Ateso, Acholi, Lango, Karamojong, Alur, Kakwa.
  - *Uganda — Central Sudanic*: Lugbara, Ma'di, Aringa.
  - *Africa*: Arabic (RTL), Hausa, Yoruba, Igbo, Amharic, Zulu.
  - *Asia*: Mandarin Chinese, Hindi, Bengali, Japanese, Indonesian, Russian, Turkish.
  - *Europe*: German, French, Spanish, Italian.
  - *The Americas*: Portuguese, Quechua, Guarani.
  - *Oceania*: Tok Pisin, Māori, Samoan, Tongan, Fijian.
- **Translation coverage**: **every visible string** in the storefront is now
  a catalogue key — the eleven pages, the Layout, the Landing page (hero,
  feature cards, steps, footer, the full disclaimer modal), all form labels,
  placeholders, empty states, table headers, buttons, error banners and the
  order/invoice/ticket **status and priority badges**. **English** is the
  complete baseline, and **Kiswahili, Luganda, French, Spanish, Portuguese,
  German, Italian and Arabic** are translated **in full** — choosing one of
  those changes the whole storefront. **Runyankole** and **Acholi** are
  partial; every other language falls back to English **key by key**. Only
  server-supplied data (company names, product names, amounts) stays as the
  API returns it.
- **No back-end change** — the preference is client-side only; every API
  response is unchanged.

### How it works

- `mbms/storefront/src/locales/en.js` — the complete key catalogue (~190
  keys). `eu.js` — full French, Spanish, Portuguese, German, Italian.
  `regional.js` — full Swahili, Luganda, Arabic; partial Runyankole, Acholi.
  `index.js` — `LANGUAGE_LIST` (code, English label, native name, `region`
  group, optional `dir: 'rtl'`), `dirForLang()`, `FULLY_TRANSLATED_LANGS`,
  and the assembled `LOCALES` map (untranslated codes → `{}`).
- `mbms/storefront/src/lib/i18n.jsx` — `I18nProvider` (persists
  `storefront.lang`, sets `<html lang>` **and `dir`**), `useI18n()`,
  `useT()`. `t(key, vars)` → chosen language → English → key, with
  `{name}`-style interpolation. `tStatus()` / `tPriority()` translate a raw
  enum via `status.*` / `priority.*` keys, falling back to the old
  UPPER-CASE humanised form for any enum not in the catalogue.
- `LanguageSwitcher.jsx` (grouped `<select>`) in `Layout.jsx`, `Login.jsx`
  and `Landing.jsx`. `storefront.css` carries the `[dir='rtl']` fixes.
- **Every** storefront page renders through `t()` / `tStatus()` /
  `tPriority()`; `lib/format.js`'s `statusLabel` is no longer used by the UI.

### Files touched

```
mbms/storefront/src/locales/en.js               # new — complete key catalogue
mbms/storefront/src/locales/eu.js               # new — full fr / es / pt / de / it
mbms/storefront/src/locales/regional.js         # new — full sw / lg / ar; partial nyn / ach
mbms/storefront/src/locales/index.js            # LANGUAGE_LIST (43) + dirForLang + LOCALES assembly + FULLY_TRANSLATED_LANGS
mbms/storefront/src/lib/i18n.jsx                 # I18nProvider / useT / tStatus / tPriority; sets lang + dir
mbms/storefront/src/components/LanguageSwitcher.jsx  # grouped language picker
mbms/storefront/src/App.jsx                      # <I18nProvider>
mbms/storefront/src/components/Layout.jsx        # nav + header via t()
mbms/storefront/src/pages/*.jsx                  # all 11 pages: every visible string via t() / tStatus() / tPriority()
mbms/storefront/src/styles/storefront.css        # .sf-lang* + [dir=rtl]
```

Verified with the running storefront: the **French** Orders screen (filter,
table headers, status badges "EN LIVRAISON / CONFIRMÉE / LIVRÉE / ANNULÉE",
tracker steps, buttons), the **German** Account screen (every field label,
"Netto 30", "+ Lieferadresse hinzufügen"), and the **Arabic** Home screen —
entirely translated and mirrored right-to-left, with only company names and
amounts left as data. Untranslated languages degrade to English per string.
Screenshots: `screenshots/Customer/15-i18n-full-french-orders.png`,
`screenshots/Customer/16-i18n-full-arabic-home-rtl.png`,
`screenshots/Customer/17-i18n-full-german-account.png` (plus 11–14 from the
earlier passes).

### Database content, both directions (27 August 2026)

Beyond the UI strings, **database values are shown in the customer's language,
and text the customer types is stored in English.**

- **Read** — the storefront sends `Accept-Language: <lang>` on every API call
  (`storefront/src/lib/api.js`). The customer-portal endpoints map outgoing
  database text — **product category names, product names, units of measure**,
  and the reachable parts of descriptions and support-ticket bodies —
  through a **curated glossary** into that language. Rows are unchanged; the
  mapping happens on the way out.
- **Write** — when a customer submits a support ticket, a ticket reply or a
  delivery address in another language, the text is **normalised to English
  for storage**. The row's `source_language` and the customer's **exact
  original wording** are kept in companion columns (`*_original`), so nothing
  is lost: the customer sees their own words back while browsing in that
  language, and staff see (and store) English. The admin **Support Tickets**
  screen shows English with a "show customer's original" toggle.
- **Free-form prose** (arbitrary description / ticket text outside the
  glossary) is handled by a `TranslationProvider` seam whose bundled
  implementation is a **no-op** — this proof-of-concept is offline with no
  translation service. A real provider (DeepL, an LLM, …) plugs in there and
  is selected with `CONTENT_TRANSLATION_PROVIDER`. Enum values (order /
  invoice / ticket status, priority) are covered by the existing
  `status.*` / `priority.*` UI catalogue, not the glossary.

**How it works**

- `mbms/backend/src/common/translation/` (new): `content-glossary.ts`
  (bidirectional phrase + token maps for the finite storefront vocabulary),
  `translation.provider.ts` (`TranslationProvider` interface +
  `IdentityTranslationProvider`), `content-translation.service.ts`
  (`resolveLang`, `toLocale`, `localiseFields`, `toEnglish`),
  `translation.module.ts` (`@Global`).
- One Prisma migration (`content_translation_originals`) adds
  `source_language` + `*_original` columns to `support_tickets`,
  `ticket_messages` and `delivery_addresses`.
- Customer-portal catalog, support and account controllers/services read the
  `Accept-Language` header and call the service; `SupportService` and
  `CustomerAccountService` normalise inbound text to English and persist the
  originals.
- Admin: `mbms/frontend/src/pages/SupportTickets.jsx` gains the "show
  original" disclosure; the ticket resource now carries `sourceLanguage` /
  `*Original`.

Verified against the running API: catalogue categories return as
"Pembejeo za Kilimo / Mafuta / Ghala …" (Swahili) and product names
token-translate ("Maïs Semence — 25kg Sac" in French); a support ticket
written in Luganda is stored with an English `subject`/`description`,
`source_language = 'lg'` and the Luganda originals preserved, the customer
still sees their own words, and the same customer viewing in French gets the
English glossary-translated into French rather than the Luganda original.
Screenshot: `screenshots/Customer/18-i18n-db-content-shop-swahili.png`.

**Extended to promo banners & CMS content (28 August 2026).** When Marketing &
Promos and CMS / Site Builder were activated, their storefront reads were still
served as stored English. They now use the same seam:

- `GET /customer-portal/promo-banners` localises **heading / body / link
  label**; `GET /customer-portal/content[/:slug]` localises the **page title
  and body** — via `Accept-Language`, with digits in the language's script
  (e.g. Arabic-Indic). The stored value stays English; only the response is
  localised.
- The checkout discount validator returns a stable **`messageKey`** (+
  `messageParams`, e.g. the minimum-order amount) so "that code has expired" /
  "this code needs a subtotal of at least …" show in the chosen language;
  `message` remains as the English fallback and is what the **409** on order
  placement carries.
- `content-glossary.ts` gains the seeded banner and content strings for the
  eight fully-translated languages; the eight storefront locale files gain the
  `cart.discount.*` message keys (previously English-only). Body prose beyond
  the curated entries still falls through to the provider (no-op offline).
- **Write direction unchanged** and re-verified — a delivery address typed in
  Swahili is still stored as `label: "Warehouse"` with `labelOriginal:
  "Ghala"`, `source_language: "sw"`. Nothing in the promo / CMS flows is
  customer-typed (a discount code is a language-neutral identifier).

`marketing.service.ts` / `cms.service.ts` take a `lang` argument and call
`ContentTranslationService`; `customer-storefront.controller.ts` resolves
`Accept-Language`; `discount.util.ts` adds `messageKey` to every outcome.
Verified: promo banner + About / Terms / Delivery pages render in FR / SW / DE /
AR; the EN view is unchanged. Screenshots:
`screenshots/Customer/{Home_promo_banner_Swahili,Content_page_Swahili}.png`.

### Currency and figures (27 August 2026)

Amounts come from the API in **UGX**. When the customer's chosen language
belongs to a region that uses another currency, the storefront **converts and
re-formats** every amount for that locale — value, grouping, decimal mark,
currency name and (where the language uses one) digit script all follow it.
Uganda's languages keep UGX. Numerals in localised database text (e.g. the
"25kg" inside a product name) and standalone counts (quantities, stock,
KPI tiles) are rendered in the language's own digit script.

| Chosen language | Currency shown | Example (from `UGX 96,000`) |
|-----------------|----------------|------------------------------|
| English, Swahili, Luganda, … (Uganda) | UGX (unchanged) | `UGX 96,000 (≈ $25.26)` |
| Arabic | AED | `93.93 درهم إماراتي` · product name `… ١٠kg …` |
| French, Spanish, German, Italian | EUR | `23,13 €` → **`23,13 euros`** (`fr-FR` grouping/decimals) |
| Portuguese | BRL | `137,14 reais brasileiros` |

- Rates are **fixed demo constants** (`UGX per 1 unit` — `USD 3800`,
  `EUR 4150`, `AED 1022`, `BRL 700`), consistent with the pre-existing
  "no live FX feed" note.
- **Read:** `mbms/storefront/src/lib/format.js` — `money()` (locale currency
  conversion via `Intl.NumberFormat(..., {style:'currency', currencyDisplay:'name'})`),
  `figure()` (locale-formatted integers), `localizeDigits()`. `CURRENCY_BY_LANG`
  / `UGX_PER_UNIT` / `LOCALE_TAG` maps. Backend `ContentTranslationService.toLocale`
  also transliterates digits in text for scripts that need it
  (`DIGIT_SCRIPTS`, Arabic-Indic).
- **Write:** `ContentTranslationService.toEnglish` runs `toWesternDigits()`
  on all inbound text **before** anything else — even for an otherwise
  unsupported language — so a figure a customer typed as "٥" is stored as
  "5". The `*_original` columns keep the customer's exact numerals.
- **Limit:** converting a currency *amount written in free prose* (e.g. "I
  paid €50" inside a ticket) is provider-seam territory, like free-text MT;
  digit transliteration is deterministic and always applied.

Verified: the storefront in **Arabic** shows catalogue prices as
"93.93 درهم إماراتي" with Arabic-Indic digits in product names ("١٠kg"), and
in **French** every amount as EUR with `fr-FR` formatting ("3 687,04 euros").
A support ticket typed in Arabic with Arabic-Indic digits is stored with
Western digits and the original kept. Screenshots:
`screenshots/Customer/19-i18n-figures-arabic-shop-aed.png`,
`screenshots/Customer/20-i18n-figures-french-home-eur.png`.

---

## Subsidiary lifecycle & the Clearing / Forwarding subsidiary (27 August 2026)

The **Managing Director** can now **view, create, update, delete and
activate/deactivate** subsidiaries and everything under them — branches,
departments, policies and users.

- **Permissions**: the `Managing Director` role now holds
  `organization.company.manage` and `identity.user.manage` (previously
  group-wide *view* only).
- **New endpoints** under `/organization`:
  `DELETE /companies/{id}`, `POST /companies/{id}/activate`,
  `POST /companies/{id}/deactivate`, `DELETE /branches/{id}`,
  `DELETE /departments/{id}`, `DELETE /policies/{id}` — all requiring
  `organization.company.manage`, all audited.
- **Delete is guarded**: a company is only hard-deleted when it has no
  subsidiaries, branches, departments, employees, customers, suppliers,
  products, ledger accounts or inter-company transactions — otherwise it
  returns **409** ("…still has 6 branch(es), 8 department(s)… Deactivate it
  instead."). The **root holding company can never be deleted or
  deactivated.**
- **Admin UI**: `Companies.jsx` gains a per-row Activate/Deactivate + Delete
  column for subsidiaries; `CompanyDetail.jsx` gains Delete on each branch /
  department / policy row and Activate/Deactivate/Delete for the subsidiary
  itself — shown to Managing Director / Super Administrator / IT Administrator.

### Morise Clearing & Forwarding Ltd

Seeded as a real **wholly-owned (100%) subsidiary** for the Group's
clearing / forwarding / logistics business:

- **6 branches** — Kampala HQ, Malaba Border Office, Busia Border Office,
  Entebbe Airport Office, Mutukula Border Office, Elegu Border Office.
- **8 departments** — Customs Clearance, Freight Forwarding, Warehousing,
  Logistics & Supply Chain, Export Facilitation, Fleet Management, Client
  Services, Finance & Billing.
- **4 starter policies** — KYC Documentation Requirement, Disbursement
  Pre-funding Threshold, Demurrage & Detention Escalation, Tax & Levy Rate
  Configuration.

Its **multi-module system** (16 feature areas — client & CRM, job files,
customs clearance with the URA duty/tax engine, freight forwarding, logistics
& supply chain, export facilitation, warehousing, multi-branch management,
finance & billing, document management, tracking & notifications, reporting &
analytics, compliance & risk, integrations, mobile apps, admin/security) is
captured as a **new specification document, `docx/19_Clearing, Forwarding and
Logistics System — Feature Specification …`**, with a five-phase delivery
backlog. **None of those modules are built** in the current slice; the org
structure above is real and manageable now.

### Morise Warehouse Management Ltd

A second wholly-owned (100%) subsidiary, set up by the MD using the same
lifecycle capability — multi-branch warehouse operations for Uganda:

- **5 branches** — Kampala Central Warehouse, Jinja Warehouse, Mbarara
  Warehouse, Gulu Warehouse, Mbale Warehouse.
- **9 departments** — Branch Operations, Inventory Control, Receiving &
  Putaway, Order Fulfilment, Yard & Dock, Reporting & BI, IT & Integrations,
  Compliance & Security, Field & Mobile Operations.
- **5 starter policies** — FEFO/FIFO Stock Rotation, Cycle Count Schedule,
  Write-off & Transfer Approval, EFRIS/VAT Configuration, Offline Operation &
  Sync.

Its **Warehouse Management System** (12 feature areas — multi-location &
branch management, core inventory with batch/lot/serial/multi-UOM, receiving &
putaway, order fulfilment, Uganda-specific features — 18% VAT with EFRIS/URA,
mobile money, offline mode, Luganda/Swahili/Runyankole-Rukiga interfaces,
power-outage resilience — yard & dock, reporting & BI, integrations & APIs,
mobile & field, security & compliance aligned with the Data Protection and
Privacy Act 2019, advanced/future-ready — AI forecasting, IoT cold-chain,
RFID, AGV, blockchain traceability — and user management & workflow) is
captured as **`docx/20_Warehouse Management System (WMS) — Feature
Specification …`**, with a five-phase backlog. **Not built.**

### Morise Collateral Management Ltd (30 August 2026)

A **third** wholly-owned (100%) subsidiary, set up by the MD the same way —
a **collateral management agent (CMA)** that monitors physical goods pledged
as collateral (commodities, inventory, stored assets) for banks and
financiers across many client sites (warehouses, silos, tank farms, yards,
cold stores):

- **6 sites / branches** — Kampala Head Office, Jinja Grain Silos, Mbale
  Warehouse, Masindi Grain Store, Kasese Cold Store, Buikwe Tank Farm.
- **9 departments** — Field Inspection; Site & Warehouse Management; Stock &
  Collateral Control; Inspection & Audit; Release & Movement Authorization;
  Client & Lender Relations; Compliance & Risk; Workforce & Rostering; IT &
  Integrations.
- **6 starter policies** — GPS & Evidence Integrity, Dual-Control Release
  Approval, Coverage Threshold Auto-Hold, Offline Field Sync, Multi-Client
  Stock Segregation, Inspection Frequency by Risk.

Its **Multi-Site Collateral Management System** (10 feature modules — site &
warehouse management with geofenced boundaries; an offline-first field
inspector mobile app; staff & workforce management; per-site stock &
collateral management with a valuation / coverage engine; inspection & audit
workflow with variance detection; dual-control release & movement
authorization with lender OTP; a client / lender portal; alerts &
notifications; reporting & compliance; document management — plus
non-functional requirements, architecture, integration and roadmap tables,
user roles and a technology stack) is captured as **`docx/21_Multi-Site
Collateral Management System — Feature Specification …`** (restating the
client-supplied
`docx/Multi-Site-Collateral-Management-System-Feature-Specification.docx` in
the house format), with a five-phase backlog. **Not built.**

**Priced services catalogue (30 August 2026)** — the subsidiary now has
**10 priced services** in the group storefront (`CMC-5001`–`CMC-5010`),
mapped from the client's
`docx/Collateral-Management-Company-Services-Catalog.docx` onto its six
sites, across five categories:

| Category | Services |
|---|---|
| Custody & Control | CMA setup & onboarding · Field Warehousing Control |
| Inspection & Verification | Stock Inspection Visit (quantity/quality/sampling) · Weighbridge & Tank/Silo Gauging |
| Stock & Movement Control | Stock Reconciliation & Variance Report · Dual-Control Release Authorization |
| Risk & Valuation | Collateral Valuation & Coverage-Ratio Monitoring |
| Reporting & Compliance | Daily Stock-Position Reporting + Lender Portal · Warehouse Receipt Issuance · Facility/Site Accreditation Assessment |

It gets the standard 6-account starter chart + an open FY2026-Q1 period
(`ensureStorefrontBooks`), so its storefront orders invoice and GL-post in
its own books — same as Clearing & Forwarding / Warehouse Management
(Update 47). Category names + ~25 service-name tokens added to
`content-glossary.ts` so the rows localise. `docx/21` gains a **"Services
Catalogue Seeded into the Storefront"** addendum (the reference catalogue's
9 categories, the physical-vs-financial table, and the 10 seeded services).
The **Collateral Management System itself stays a future-phase backlog** —
only the priced catalogue is live.

**Seed only** — no code, schema or permission change (company id
`…006`; sites `…0030–0035`; departments `…0030–0038`; policies `…0030–0035`;
services `CMC-5001`–`CMC-5010`). Group figures now: **5 subsidiaries, 20
sites / branches, 34 catalogue items across 18 categories**.

### Files touched (across all three subsidiary passes)

```
mbms/backend/src/organization/{companies,branches,departments,policies}/*.{service,controller}.ts  # remove(); companies setStatus() + activate/deactivate
mbms/backend/prisma/seed.ts                        # MD role: + organization.company.manage, + identity.user.manage; seed the C&F and Warehouse subsidiaries + their branches/departments/policies
mbms/frontend/src/pages/Companies.jsx              # per-row Activate/Deactivate/Delete for subsidiaries
mbms/frontend/src/pages/CompanyDetail.jsx          # Delete on branch/department/policy rows; subsidiary Activate/Deactivate/Delete
docx/19_Clearing, Forwarding and Logistics System - Feature Specification - Morise Holdings Limited.docx  # new
docx/20_Warehouse Management System (WMS) - Feature Specification - Morise Holdings Limited.docx          # new
```

Verified end-to-end: as the Managing Director — created, updated, added a
branch/department/policy to and deleted a test subsidiary; deactivated and
reactivated it; and was correctly blocked (**409**) from deleting a populated
subsidiary. Both new subsidiaries and all their branches, departments and
policies are visible and manageable via the admin Companies screens. No schema
change.

---

## Inventory section activated (28 August 2026)

The **Inventory** item under ADMIN / BACKEND was a *Coming Soon* placeholder
from the navigation redesign. It is now a working screen for **company-level
inventory** — one stock-on-hand figure per product, re-order points, stock
adjustments and an immutable movement ledger.

- **Stock levels** — every product with its code, category, unit of measure,
  on-hand quantity, unit price, **stock value**, and a status of **In stock /
  Low / Out of stock**. KPI tiles for stock-keeping units, low stock, out of
  stock and total stock value. Company selector, search and a low/out-of-stock
  filter.
- **Re-order points** — new `products.reorder_point` column. At or below it →
  *Low*; at zero → *Out of stock*. Set / cleared from the screen.
- **Stock adjustments** — `receipt` (goods in, adds), `issue` (goods out,
  subtracts, **409** if more than is in stock), `count` (physical count: the
  counted figure becomes the on-hand and the signed difference is recorded).
  Each names a reason and an optional reference (GRN / order no.).
- **Movement ledger** — new `stock_movements` table (`StockMovementType` enum
  `receipt | issue | count`). Every adjustment writes an immutable row —
  signed quantity, resulting balance, reason, reference, user, timestamp —
  shown newest-first on the **Movements** tab.
- **Access & audit** — reads scoped per BR-01 exactly like the product list;
  writes require `product.manage`; every adjustment and threshold change is
  audited (`inventory.stock.adjusted`, `inventory.reorder_point.updated`). No
  new role or permission — the existing `product.viewAll` / `product.manage`
  pair gates the screen, so it is permission-filtered like every other admin
  route.

**Scope boundary:** company-level only. Per-branch stock balances, bin /
location tracking and inter-branch transfers remain **Warehouse Management
System** scope (`docx/20`, Module 2 *Core Inventory Management*) — this is the
first working slice of that module on the shared platform.

### Files touched

```
mbms/backend/prisma/schema.prisma                     # + Product.reorderPoint, + StockMovement model, + StockMovementType enum
mbms/backend/prisma/migrations/20260828120000_inventory_stock_movements/   # new
mbms/backend/prisma/seed.ts                           # catalogue products get a re-order point + opening-balance movement
mbms/backend/src/inventory/                           # new module — controller, service, DTOs
mbms/backend/src/app.module.ts                        # register InventoryModule
mbms/frontend/src/pages/Inventory.jsx                 # new page (stock levels + movements + Adjust / Re-order-point modals)
mbms/frontend/src/App.jsx                             # /inventory → InventoryPage (removed from STUB_ROUTES)
mbms/frontend/src/components/Layout.jsx               # Inventory nav item loses its "Soon" badge
```

Verified end-to-end: `GET /inventory/stock` returns levels, valuation and
Low/Out flags with a summary; `receipt` raises on-hand and `issue` lowers it;
issuing more than is in stock is rejected **409**; `count` sets the absolute
figure and records the signed delta; the re-order point drives the status
badge; a user without `product.manage` is refused adjustments (**403**); every
write lands in the audit trail. Screenshot: `screenshots/Administrator/Inventory.png`.

---

## Marketing & Promos and CMS / Site Builder activated (28 August 2026)

Two more ADMIN / BACKEND placeholders became working screens, and the
**customer storefront consumes both**.

### Marketing & Promos (`/marketing`)

- **Discount codes** — new `discount_codes` table (`DiscountType`
  percentage / fixed, `DiscountCodeStatus`). A code has a value, optional
  minimum order, validity window (`startsAt` / `endsAt`) and redemption cap
  (`maxRedemptions` / `timesRedeemed`). Admin CRUD + activate / deactivate +
  **`DELETE /marketing/discount-codes/:id`** (safe — `orders.discount_code` is
  stored as text, so past orders keep the code after it is deleted);
  per-company, scoped per BR-01.
- **Storefront checkout** — the cart calls `POST
  /customer-portal/discount-codes/validate` and shows a discount line + revised
  total; `POST /customer-portal/orders` accepts `discountCode`, **re-validates
  server-side**, takes the discount off the subtotal *before* VAT and delivery,
  redeems the code **once** (increments `timesRedeemed` in the order
  transaction), and returns `discountCode` / `discountAmount`. An invalid code
  is a **409**. `orders` gains `discount_code` + `discount_amount`.
- **Promo banners** — new `promo_banners` table (heading, body, link,
  placement, schedule, `active`). The storefront **home** renders the
  currently-live banners (`GET /customer-portal/promo-banners`).
- One database-free `evaluateDiscountCode()` is shared by the validate
  endpoint and `OrdersService`, so the cart and the placed order can never
  disagree.

### CMS / Site Builder (`/cms`)

- New `content_blocks` table (`ContentBlockStatus` draft / published). Each
  page keeps a working copy (`body`) and a published snapshot
  (`publishedBody`) — **editing never changes what the storefront serves until
  Publish**. Admin: list + editor + Save draft / Publish / Unpublish / Delete.
- Storefront: **public** `GET /customer-portal/content` and `/content/:slug`
  (published only) → a new `/page/:slug` route renders the page, linked from
  the Landing footer. **About**, **Terms & Conditions**, **Delivery & Returns**
  are seeded and published.

### Access & audit

Two new permission pairs — `marketing.manage` / `marketing.viewAll`
(**operations** domain) and `cms.manage` / `cms.viewAll` (**governance**
domain). Reads need the `viewAll` or the `manage` code; writes need `manage`.
Seeded holders: **Super Administrator**, **IT Administrator** and the
**Managing Director** hold **all four** — the MD can view / create / update /
delete / execute both sections in full (updated 28 August 2026; the MD held
only the `viewAll` codes when the sections were first activated); **Sales
Manager** holds `marketing.*`. Every change is audited
(`marketing.discount_code.*`, `marketing.banner.*`, `cms.content_block.*`). The
delegation domains already existed, so `delegation.rules.ts` was unchanged — a
Branch Manager can delegate
`marketing.*` (operations) within their branch.

### Files touched

```
mbms/backend/prisma/schema.prisma                       # + DiscountCode, PromoBanner, ContentBlock (+ enums); Order.discountCode/discountAmount
mbms/backend/prisma/migrations/20260828160000_marketing_promos_cms/   # new
mbms/backend/prisma/seed.ts                             # 4 permissions + role links (Managing Director holds all four — full CRUD); demo codes, banner, content pages
mbms/backend/src/marketing/                             # new module (+ discount.util.ts shared rule); DELETE /marketing/discount-codes/:id
mbms/frontend/src/pages/Marketing.jsx                   # + Delete on a discount-code row
mbms/backend/src/cms/                                   # new module
mbms/backend/src/customer-portal/storefront/            # new — public content + authed promo/validate controllers
mbms/backend/src/sales/orders.service.ts                # apply + redeem discount in the order transaction
mbms/backend/src/sales/dto/create-order.dto.ts          # + discountCode
mbms/frontend/src/pages/Marketing.jsx, Cms.jsx          # new pages (removed both from STUB_ROUTES)
mbms/frontend/src/lib/capabilities.js                   # /marketing, /cms → new codes
mbms/storefront/src/pages/Cart.jsx                      # discount-code field + line
mbms/storefront/src/pages/Home.jsx                      # promo banners
mbms/storefront/src/pages/Page.jsx                      # new — /page/:slug
mbms/storefront/src/pages/Landing.jsx, App.jsx          # footer links + route
```

Verified end-to-end: percentage and fixed discounts compute correctly (10% of
UGX 288,000 → UGX 28,800 off, VAT on the discounted subtotal); minimum-order,
expiry and redemption-cap rejections; the code redeemed exactly once with
`timesRedeemed` incremented; an invalid code at checkout → **409**; a user
without `marketing.manage` / `cms.manage` refused writes (**403**) but allowed
reads with `viewAll`; a draft content page **404**s on the storefront until
published, and re-appears updated after Publish. Screenshots:
`screenshots/Administrator/Marketing.png`, `screenshots/Administrator/CMS.png`,
`screenshots/Customer/{Home_with_promo_banner,Cart_with_discount_code,Content_page}.png`.

**Update (28 August 2026):** the **Managing Director** now holds
`marketing.manage` + `cms.manage` as well as the `viewAll` codes, so the MD can
**view / create / update / delete / execute** discount codes, promo banners and
content pages in full (previously `viewAll` only — the "+ New" controls showed
but writes returned **403**). A `DELETE /marketing/discount-codes/:id` endpoint
was added for the delete action. Re-verified as the Managing Director: create →
update → deactivate → **delete** a discount code; create / update / delete a
banner; create / update / **publish** / **unpublish** / delete a content page —
all `200`/`201`; a role without the codes (Auditor) is still **403**.

---

## HR Dashboard & Departments activated (28 August 2026)

Two HUMAN RESOURCES placeholders became working screens — on the existing HR
data, **no schema change and no new permission**.

### HR Dashboard (`/hr`)

Read-only. `GET /api/v1/hr/dashboard` aggregates the employee, attendance,
leave and recruitment modules into four groups:

- **Headcount** — active / inactive, and by **company / branch / department /
  contract type**.
- **Attendance (last 30 days)** — records, **absence rate %**, **late rate %**,
  present / half-day counts.
- **Recruitment** — open vacancies, positions open, awaiting approval, and the
  **candidate pipeline by stage** (applied → shortlisted → interview scheduled
  → interviewed → offered).
- **Upcoming (next 30 days)** — contracts ending, probation ending (start +
  90d), approved leave starting.

Visible to any holder of an HR `viewAll` permission (`employee` / `recruitment`
/ `attendance` / `leave` / `performance`); group-wide for those holders, scoped
to the caller's companies otherwise. Backend: new module
`src/hr-dashboard/`.

### Departments (`/departments`)

The dedicated screen for a data entity that already existed. `GET
/api/v1/organization/departments` lists **every department across the
companies in scope** with its company name and current **headcount**. Create /
rename / delete reuse the existing org endpoints (`POST
/organization/companies/:id/departments`, `PATCH` / `DELETE
/organization/departments/:id`); **delete is blocked (409) while staff are
assigned**. Writes need `organization.company.manage`; the list is also visible
to `organization.company.viewAll` / `employee.viewAll` / `recruitment.viewAll`
as a read-only view.

### Demo data

Morise Agro Ltd gains three departments (Field Operations, Finance &
Administration, Warehouse & Distribution) with its three employees assigned one
each; ~3 working weeks of recent attendance (a scatter of late / absent days);
one fixed-term contract ending in ~3 weeks; one approved leave starting in ~10
days — so both screens show live figures on a fresh database.

### Files touched

```
mbms/backend/src/hr-dashboard/                        # new module (controller + service)
mbms/backend/src/app.module.ts                        # register HrDashboardModule
mbms/backend/src/organization/departments/*.ts        # + listAll() + GET /organization/departments
mbms/backend/prisma/seed.ts                           # Agro departments + assignments, recent attendance, upcoming contract/leave
mbms/frontend/src/pages/Hr.jsx, Departments.jsx       # new pages (removed both from STUB_ROUTES)
mbms/frontend/src/lib/capabilities.js                 # /departments visible to org/HR viewAll too
```

Verified: as the Managing Director the HR Dashboard returns headcount **3**
across 3 departments, **45** attendance records (**4.4%** absence, **13.3%**
late), the recruitment pipeline, and the seeded contract-ending
(David Ssenyonga) and leave-starting (Peter Kintu) rows; a **Human Resources
Manager** sees the same; a **Sales Manager** without an HR `viewAll` permission
is refused (**403**). Departments create / rename / delete all succeed, and
deleting a staffed department is refused (**409**). Screenshots:
`screenshots/Administrator/{HR_Dashboard,Departments}.png`.

---

## Shift Scheduling & Payroll activated (28 August 2026)

The last two HUMAN RESOURCES placeholders became working modules.

### Shift Scheduling (`/shift-scheduling`)

New `roster_entries` table — one employee × one calendar day → one shift
template, `status` **planned** or **published**. `@@unique(employee, date)`, so
a second assignment for the same day is rejected as a **clash (409)**.

- `GET / POST / DELETE /api/v1/shift-scheduling/entries`
- `POST /shift-scheduling/publish` — promotes a date range from *planned* to
  *published* and **notifies each affected employee** who has a login.
- `GET /shift-scheduling/coverage` — per day: staffed count, unrostered count,
  and **clash flags** (rostered on a day the employee is also on approved
  leave).
- Roster writes reuse **`attendance.manage`** / view reuses
  `attendance.viewAll` — **no new permission** for shift scheduling.

Admin page: a weekly employee × day grid with shift badges (amber = planned,
green = published), a `+` cell to assign, a coverage row, and a Publish action.

### Payroll (`/payroll`)

`Employee` gains `gross_salary` + `pay_frequency`. New `payroll_runs`,
`payslips` and `salary_advances` tables.

- **`POST /api/v1/payroll/runs`** — for every active employee with a gross
  salary, computes **Uganda PAYE** (income-tax bands) + **NSSF** (5% employee /
  10% employer) + any approved salary-advance instalment, and writes a payslip.
  Draft. A duplicate run for the same month → **409**.
- **`POST .../runs/:id/approve`** then **`.../pay`** — pay posts a **balanced
  journal entry** (Dr staff costs = gross + employer NSSF; Cr PAYE Payable,
  NSSF Payable, Staff Advances, Salaries Payable) into the open financial
  period, and advances each recovered salary advance. `.../cancel` for a
  draft/approved run.
- **Salary advances** — `GET`, `POST` (request), `POST .../approve | .../reject`.
  Recovered in instalments (`amount / instalments`, capped at outstanding,
  never taking net below zero) on each run; flips to `recovered` when repaid.
- **New permissions** (hr domain): `payroll.manage` (create a run, request an
  advance), `payroll.approve` (approve / pay a run, approve / reject an
  advance), `payroll.viewAll`. Seeded: Super Admin + IT Admin (all three), **HR
  Manager** (manage + viewAll), **Managing Director** + **Finance Manager**
  (approve + viewAll) — the same prepare-vs-approve split as expenses.
- The PAYE/NSSF constants live in a database-free
  `src/payroll/uganda-statutory.util.ts`.

### Files touched

```
mbms/backend/prisma/schema.prisma                     # + Employee.grossSalary/payFrequency; + RosterEntry, PayrollRun, Payslip, SalaryAdvance (+ enums)
mbms/backend/prisma/migrations/20260828190000_shift_scheduling_payroll/   # new
mbms/backend/prisma/seed.ts                           # 3 payroll permissions + role links; demo salaries, roster, salary advance
mbms/backend/src/shift-scheduling/                    # new module
mbms/backend/src/payroll/                             # new module (+ uganda-statutory.util.ts)
mbms/backend/src/app.module.ts                        # register both modules
mbms/frontend/src/pages/ShiftScheduling.jsx, Payroll.jsx   # new pages (removed both from STUB_ROUTES)
mbms/frontend/src/lib/capabilities.js                 # /payroll → payroll.* (was __platform_admin__)
```

Verified: a **Human Resources Manager** builds + publishes a roster and creates
a draft payroll run (Agro — 3 staff, gross **UGX 5,600,000**, PAYE **UGX
1,386,000**, employee NSSF **UGX 280,000**, net **UGX 3,734,000**; PAYE for a
UGX 2,800,000 salary = **UGX 742,000**, matching the band schedule). The
**Managing Director** approves + pays it — a balanced journal entry (**Dr
6,160,000 / Cr 6,160,000**) is posted and the seeded salary advance advances to
*recovering* (UGX 200,000 of 600,000). A **Sales Manager** with no HR
permission is refused (**403**); a duplicate month run → **409**; a second
roster entry for one employee/day → **409**. Screenshots:
`screenshots/Administrator/{Shift_Scheduling,Payroll}.png`.

---

## My HR self-service activated (28 August 2026)

The six MY HR placeholders are now working self-service screens. Every one is
**scoped to the Employee record linked to the signed-in user** (`Employee.userId`);
an account with no linked record sees a "ask HR to link your account" notice.
**No schema change, no new permission.**

- New module `src/my-hr/` — `GET /api/v1/my-hr/{summary, attendance, leave,
  shifts, performance, payslips, salary-advances}`. Each resolves the caller's
  employee and returns only their rows. `summary` returns `linked:false` (and
  the detail endpoints **404**) for an unlinked account.
- **Actions reuse existing endpoints**: Clock In / Out → `POST
  /attendance/clock-in | clock-out` (already un-gated, self-resolving); My
  Leave → `POST /leave/applications` + `.../cancel`; My Performance → `POST
  /performance/reviews/:id/self-assessment` (already checks the review is
  yours). Only **`POST /api/v1/my-hr/salary-advances`** is new — a self-service
  advance request (the staff endpoint needs `payroll.manage`), with a
  one-open-advance-at-a-time guard (**409**).
- Screens (`src/pages/MyHr.jsx`, six components): **Clock In / Out** (today's
  status + one-tap buttons + 30-day counts + history), **My Leave** (balance
  cards + requests table + apply/cancel), **My Shifts** (my roster, today
  highlighted), **My Performance** (objectives + reviews + self-assessment
  dialog), **My Payslips** (list + breakdown dialog), **My Salary Advances**
  (list + request dialog).

### Files touched

```
mbms/backend/src/my-hr/                # new module (controller + service + dto)
mbms/backend/src/app.module.ts         # register MyHrModule
mbms/frontend/src/pages/MyHr.jsx       # new — 6 self-service pages (removed all 6 from STUB_ROUTES)
mbms/frontend/src/App.jsx, components/Layout.jsx   # routes; "Soon" badges removed
```

Verified as **Peter Kintu** (a demo login linked to an employee record): the
summary returns his linked profile; clock-in updates today + the 30-day counts;
leave balances and requests show, and a request can be filed and cancelled; the
roster shows this week's published + next week's planned shifts; the completed
"2026 H2 Review" (rating 4/5) displays; requesting a salary advance succeeds and
a second concurrent request → **409**. A genuinely unlinked account gets
`linked:false` and **404** on the detail endpoints. Screenshots:
`screenshots/Employee/MyHR_{Clock,Leave,Shifts,Performance,Salary_Advances}.png`.

> **Update (28 August 2026):** the six My HR screens require a login **linked
> to an employee record** (`Employee.userId`). The seed now links **every
> seeded staff login** — Managing Director, IT Administrator, Auditor (new
> employee records in Morise Holdings Limited); Human Resources Manager,
> Finance Manager, Sales Manager, Procurement Manager (new records in Morise
> Agro Ltd) — each with a job title, department, gross salary and 2026 leave
> balances (the Agro ones also get the Day Shift and a current-week roster). So
> My HR shows real data for whichever demo persona is signed in, not the "not
> linked" notice. Seed-data only — no schema, code or permission change; the
> linking uses the existing employee create/edit `userId` field. Side effect:
> HR Dashboard headcount and Departments counts rise (Holdings 3, Agro 7).
> Screenshot: `screenshots/Employee/MyHR_MD_linked.png`.

---

## Financial & Accounting overview activated (28 August 2026)

The **one remaining placeholder** in the whole regrouped navigation — the
Financial & Accounting landing tile — is now a working read-only screen.
**With this, every entry in ADMIN / BACKEND, HUMAN RESOURCES, MY HR and
FINANCIAL & ACCOUNTING opens a working screen.**

- New module `src/finance/` — `GET /api/v1/finance/overview` returns
  `{ financials, operations, periods }`:
  - **financials** — consolidated + per-company financial position (assets,
    liabilities, equity, cash & bank, receivables, payables, open-period
    revenue / expense / net profit), reusing the dashboard's balance-sheet and
    income computation (`DashboardModule` now exports its service).
  - **operations** — "needs attention" working-capital figures: AP outstanding
    amount + count (+ overdue, + pending-approval), AR outstanding amount +
    count (+ overdue), expense claims awaiting finance approval, active-asset
    net book value (+ disposal requests), active / on-hold / planned project
    counts, inter-company draft count.
  - **periods** — each company's current financial period (dates + open/closed
    state) and the group totals of open / closed periods.
- New page `src/pages/Finance.jsx` — group-position KPI tiles, a by-company
  table, a "Needs attention" tile row, a period-close table, and a grid of
  **shortcut cards** into the working sub-screens (General Ledger & Journals,
  Accounts Payable, Expenses, Assets, Projects, Reports, Suppliers,
  Inter-Company). Removed from `STUB_ROUTES` (now empty); nav "Soon" badge gone.
- **Read-only, no new permission.** The endpoint is gated on *any* finance-area
  permission — the same list the front-end capability map uses for `/finance`
  (`accounting` / `ap` / `expense` / `asset` / `project` / `supplier` /
  `organization.intercompany`, in their `manage` / `approve` / `viewAll`
  forms). A user with none → **403**.

Verified as a **Finance Manager**: the overview returns the consolidated
position (group **net profit UGX 19,833,800** across 5 companies), the
working-capital figures (AP **UGX 500,000** outstanding, AR **UGX 15,301,200**
with 3 overdue, 1 expense claim awaiting finance, asset NBV **UGX 45,000,000**,
1 active project) and the two open FY2026-Q1 periods; a **Sales Manager** with
no finance permission → **403**. Screenshot:
`screenshots/Administrator/Finance_Overview.png`.

**No unbuilt screen remains anywhere in the navigation.**

---

## Customer self-service auth — sign-up, multi-identifier login, password reset (29 August 2026)

The storefront login previously took only a staff-issued **email or account
number** and had no sign-up and no password reset. Now:

### Sign up (`/register`)

`POST /api/v1/customer-portal/auth/register` — name, email, optional phone,
password, and **which Morise company to buy from** (public `GET
/customer-portal/auth/companies`). Creates an **active** customer with a
generated `CUST-` account number and **starter terms** (UGX 1,000,000 credit
limit, 14-day terms — flagged `category: "Self-registered"` for staff to review
in the CRM) and **signs in immediately**. A second account for the same email
or phone → **409**.

### Login by email · phone · account number

The single identifier field now matches **email, account number OR phone**. The
phone match ignores formatting / country-code style — `+256 701 234 567`,
`0701234567` and `701234567` all resolve to the same account (national
significant number = last 9 digits). The 5-attempt lockout is unchanged.

### Continue with Google

`POST /api/v1/customer-portal/auth/google`. **Seam** — production carries a
verified Google ID token; this offline build trusts the email the button
sends. Known email → **passwordless** login; unknown email → auto-registers a
Google-linked account.

### Forgot / reset password

`POST /customer-portal/auth/forgot-password` (by email / phone / account
number) → a one-time token, stored hashed, **30-min expiry**. `POST
/customer-portal/auth/reset-password` consumes it, sets the new password,
clears any lockout and **revokes every active session**. **Seam** — no
SMTP/SMS, so the plain token is returned in the response in dev (`devResetToken`;
the `/forgot-password` page shows a "Reset now" button); a real deployment
e-mails / SMSes a link. The forgot-password response is **identical whether or
not an account matched** — it never reveals which identifiers are registered.
The token is **single-use** (reuse → **401**).

### Files touched

```
mbms/backend/prisma/schema.prisma                                      # + Customer.selfRegistered / googleLinked; + CustomerPasswordResetToken
mbms/backend/prisma/migrations/20260829090000_customer_self_service_auth/   # new
mbms/backend/src/customer-portal/auth/customer-auth.{service,controller}.ts # register / google / forgot / reset / companies; phone in login
mbms/backend/src/customer-portal/auth/dto/customer-self-service.dto.ts      # new
mbms/storefront/src/pages/{Register,ForgotPassword,ResetPassword}.jsx       # new
mbms/storefront/src/pages/Login.jsx, components/GoogleButton.jsx            # updated login + Google seam
mbms/storefront/src/lib/auth.jsx, App.jsx, pages/Landing.jsx               # register/googleSignIn helpers, routes, landing links
mbms/storefront/src/locales/*.js                                          # auth.* strings in all 9 languages
```

Verified end to end (post-reseed): a new customer registers and is signed in
with a generated account number; then signs in with the **email**, the
**phone in three formats**, and the **account number** (all `200`); a duplicate
registration → **409**; Google sign-in logs in an existing customer and
auto-registers a new one; a `forgot-password` token lets the customer set a new
password, after which the **old password is rejected** and the **token cannot
be reused** (`401`); `forgot-password` for an unknown identifier still returns
`200` with no token. Screenshots:
`screenshots/Customer/Auth_{Login,Register,Forgot_Password}.png`.

---

## One storefront across every subsidiary and its branches (29 August 2026)

The Customer Storefront previously showed only the products of the **one**
Morise company on the customer's account. It now shows the priced, active
goods **and services of every subsidiary in the holding group**, each listing
tagged with the **subsidiary that sells it** and the **branch that produces /
fulfils it**, and the customer's own screens always show **which subsidiary
and branch their account belongs to** — the reference mockups in
`/home/obeke-vicent/Desktop/BDS/screenshoot/morise`.

### Group catalogue

`GET /api/v1/customer-portal/catalog/products` resolves the customer's
**holding group** (walk up `parentCompanyId` to the root holding company,
then collect it + every active subsidiary — `src/common/company-group.util.ts`)
and lists all of their priced, active products. Each row now carries
`companyId` / `companyName` and `branchId` / `branchName` / `branchAddress`.
New `companyId` and `branchId` query filters. `GET
/customer-portal/catalog/categories` spans the group. New **`GET
/customer-portal/catalog/subsidiaries`** → the holding company plus each
subsidiary with its branch list and branch / product counts (the Subsidiaries
directory screen).

### "Which subsidiary and branch is mine"

A nullable **`products.branch_id`** (producing / fulfilling branch) and
**`customers.home_branch_id`** (the branch of the customer's own subsidiary
that serves the account), plus a real **`orders.company_id` → `companies`**
FK, via migration `20260829120000_storefront_group_catalog_branch_attribution`.
`GET /customer-portal/me` and the login / refresh payload now return
`companyId` / `companyName`, `homeBranchId` / `homeBranchName` /
`homeBranchAddress` and the **holding company** name — shown in the header, on
**My Account** ("you buy through *subsidiary · branch*, part of *holding*")
and on every product. Sign-up gains an optional **home-branch** picker
(public `GET /customer-portal/auth/branches?companyId=`).

### Checkout across subsidiaries

An order — with its invoice and balanced GL posting — belongs to the
**selling subsidiary**, so a basket is placed as **one order per subsidiary**.
`OrdersService.createForCustomer` derives the selling company from the cart
items, uses **that** company's AR / revenue accounts, open period and
number sequences, and **rejects a single order that mixes companies**
(`409`). The storefront groups the cart by company and posts each group in
turn (one confirmation per order). A **discount code** (which belongs to one
subsidiary) is offered only on a single-company cart. The customer's
**credit limit** stays one account-wide facility, checked across every
subsidiary's invoices.

### Storefront + seed

Shop gains company / branch filters and a per-card "*company · branch*" tag;
new **Subsidiaries** directory page and nav entry; the cart is sectioned by
fulfilling subsidiary with per-company subtotals and a "placed as *N*
separate orders" note; new strings in the eight fully-translated languages.
Seed: Morise Agro's 8 products are attributed to **Kira HQ** / **Mbale
Branch**, and **Morise Logistics Ltd** gets a 4-item priced **service**
catalogue (road freight, last-mile delivery, pallet storage) on its **Jinja
Branch**, so the group shop is genuinely multi-company; the demo portal
customers get a home branch.

**Update 47 (29 August 2026)** brought the remaining two subsidiaries into the
shop: **Morise Clearing & Forwarding Ltd** (6 services — import/air customs
clearance, ocean & air freight forwarding, transit-bond documentation,
Certificate-of-Origin handling — on its Kampala HQ / Entebbe / Malaba / Busia
branches) and **Morise Warehouse Management Ltd** (6 services — ambient /
chilled / bonded storage, inbound handling, pick-pack-dispatch, cycle counts —
on its Kampala Central / Jinja / Mbarara warehouses). Seed-only: each gets a
6-account starter chart (incl. a receivable and a revenue account) + an open
`FY2026-Q1` period so its storefront orders invoice and GL-post in its own
books. The shop now lists **24 products across all four subsidiaries** (Agro 8,
Clearing & Forwarding 6, Warehouse Management 6, Logistics 4).

```
mbms/backend/prisma/schema.prisma                                          # + Product.branchId, Customer.homeBranchId, Order↔Company relation
mbms/backend/prisma/migrations/20260829120000_storefront_group_catalog_branch_attribution/   # new
mbms/backend/src/common/company-group.util.ts                              # new — resolveHoldingGroupCompanyIds / resolveHoldingCompany
mbms/backend/src/customer-portal/catalog/customer-catalog.{service,controller}.ts   # group-wide + /subsidiaries + company/branch tags & filters
mbms/backend/src/customer-portal/account/customer-account.service.ts       # /me returns subsidiary + home branch + holding
mbms/backend/src/customer-portal/auth/*                                    # /auth/branches, optional homeBranchId, names in token payload
mbms/backend/src/sales/orders.service.ts                                   # per-subsidiary order (books, numbers, notifications); mixed-cart → 409
mbms/backend/prisma/seed.ts                                                # Agro branch attribution + Morise Logistics service catalogue + demo home branches
mbms/storefront/src/pages/{Shop,Subsidiaries,ProductDetail,Cart,Account,Home,Orders}.jsx, components/Layout.jsx, lib/cart.jsx, App.jsx, locales/*.js, styles/storefront.css
```

Verified end to end (as the Highland Traders / Morise Agro portal account):
the shop lists all **12** products across Morise Agro Ltd and Morise Logistics
Ltd, each tagged with its company and branch; `/catalog/subsidiaries` lists
all **4** subsidiaries with counts; company / branch filters narrow the list;
`/me` returns the subsidiary, home branch and holding company; a cart mixing
Agro + Logistics items → **409**; a Logistics-only order places
**`ORD-2026-0001` in Morise Logistics Ltd's books** with `INV-2026-0001` and
a posted sale entry `JE-2026-0005` in that company. Backend `tsc` and both
front-end builds clean. **Not built** (documented seams): per-branch stock
splits (stock stays one figure per product) and geolocation "near me" /
distance ranking.

---

## Content localisation extended to the group storefront (29 August 2026)

The "**read database text in the customer's language, store the customer's
input in English**" behaviour (from 27–28 August — see *Customer storefront
localisation* above) now also covers the paths added by the group-catalogue
work: sign-up, the group catalogue, the Subsidiaries directory and My
Account. **A customer sees the database in the language they chose; an admin
always reads English in the database.**

**Read — rendered in the chosen language** (via the curated glossary, as far
as it reaches — proper nouns largely pass through, words like *Warehouse /
Forwarding / Border / Office / Freight / Storage / Delivery* translate):
- every product listing's **subsidiary, branch and branch-address tag**, the
  group **category list**, and the whole **`/catalog/subsidiaries`** directory
  (company names, branch names + addresses) — `/catalog/subsidiaries` now
  honours `Accept-Language`;
- **`/me`** returns the customer's own **business name and address** and the
  **subsidiary / branch / holding** names in the chosen language; when the
  customer browses in the language they *typed* their name/address in, their
  **own exact wording** is shown back instead of the translated English.
- Glossary gained the group vocabulary: **8 service categories** + **~33
  service-name tokens** (freight, forwarding, customs, clearance, transit,
  storage, handling, ocean, air, road, delivery, border, bonded, cold,
  ambient, inbound, dispatch, container, consolidation, cycle, count, …) ×
  8 languages.

**Write — stored in English + 0-9 only:**
- **Sign-up** normalises the **business name** (glossary → English; free-form
  remainder to the provider seam) and the **phone** (non-Western numerals →
  0-9). **My Account** does the same for **address** and **phone**.
- The row keeps `source_language` + the customer's exact original —
  **`customers.source_language` / `name_original` / `address_original`**
  (migration `20260829150000_customer_content_originals`) — so the storefront
  can show the customer their own words and the admin still reads the English
  columns, the same shape delivery addresses and support tickets use.

```
mbms/backend/prisma/schema.prisma + migrations/20260829150000_customer_content_originals/   # customers.source_language / name_original / address_original
mbms/backend/src/common/translation/content-glossary.ts                    # +8 category phrases, +~33 service tokens (×8 langs)
mbms/backend/src/customer-portal/catalog/customer-catalog.{service,controller}.ts   # localise company/branch/address tags + /subsidiaries (Accept-Language)
mbms/backend/src/customer-portal/account/customer-account.{service,controller}.ts   # /me localised read + name/address/phone → English on write
mbms/backend/src/customer-portal/auth/customer-auth.{service,controller}.ts         # register: name/phone → English, keep original + source language
```

Verified: browsing in **Swahili** the shop shows *"Huduma za Usafirishaji"*
for Freight Services and *"Jinja Tawi"* for Jinja Branch, and the Subsidiaries
directory reads in Swahili; registering with an **Arabic** business name and
an **Arabic-Indic** phone stores `warehouse …` and `+256 701 234 555` with
`source_language = ar` and the Arabic original kept — `GET /me` returns the
Arabic original to that customer and the English column to an English (admin)
reader; editing the address in Swahili stores the English form with the
Swahili original kept. Backend `tsc` clean. **Limitation** (unchanged since
Update 32): free-form text outside the glossary is passed through untranslated
until a real machine-translation provider is wired into the seam.

---

## Content localisation — orders & payments (30 August 2026)

The **read-in-language / store-in-English** rule now also covers the two
customer-facing areas it had not yet reached — **order history** and
**payments** — so it holds across the whole storefront.

**Read** (Accept-Language, sent by the storefront on every request):
- `GET /customer-portal/orders` and `/orders/:id` return each line item's
  **product name**, the **selling subsidiary name** and the **cancellation
  reason** in the customer's language (glossary reach; digits in the
  language's script). When the customer cancelled in the language they're
  now browsing in, their **exact original wording** is shown back. The
  order-placed confirmation is localised the same way.

**Write** (stored English + 0-9):
- An **order cancellation reason** a customer types is normalised to English
  before storage; the row keeps `orders.cancellation_reason_original` +
  `orders.cancellation_source_language` (migration
  `20260829210000_order_cancellation_reason_localisation`) — same shape as
  delivery addresses / support tickets / the customer record. **Staff** who
  cancel type English; no original kept.
- A **payment reference** (bank / mobile-money txn id) has its **digits
  normalised to 0-9** on write — it's an identifier, nothing else changes.

**No new endpoint, no new permission.** `OrdersService.toOrderResource(o,
lang, translation)`, `listForCustomer` / `getForCustomer` /
`createForCustomer` / `cancelForCustomer` take `lang`;
`customer-orders.controller.ts` injects `ContentTranslationService`;
`PaymentsService.createForCustomer` digit-normalises `reference`. Staff
paths unchanged.

**Verified**: in Swahili, `Bean Seed — 10kg Bag` → `Maharage Mbegu — 10kg
Mfuko`; cancelling with reason `Ghala` (sw) stores
`cancellation_reason = "Warehouse"`, `..._original = "Ghala"`,
`..._source_language = "sw"` — admin reads "Warehouse", the sw customer sees
"Ghala"; payment reference `MP٢٤٠٨٢٩.٠٠١` stored as `MP240829.001`. Backend
build clean.

### Final edges (30 August 2026)

A sweep of every remaining customer-facing read/write path closed the last
three gaps, so the rule now holds **everywhere**:

- **`GET /dashboard-summary`** — the Home screen's "Recent Orders" widget now
  passes the language through, so line-item and subsidiary names read in the
  chosen language.
- **`GET /invoices/statement`** — each row carries a `typeLabel`
  (`invoice` / `payment`) in the customer's language.
- **`GET /invoices/statement/pdf`, `/invoices/:id/pdf`** — the exported
  Account Statement and Invoice PDFs are **labelled in the customer's
  language** (title, "Balance", column headers, row type, invoice status),
  digits transliterated. The storefront now sends `Accept-Language` on the
  download. *Limit:* PDFKit's built-in font renders Latin scripts + 0-9
  only — a non-Latin script (Arabic, CJK…) still shows label words in
  English (font-embedding follow-up).
- **discount code** — a code a customer types at checkout or validate is
  **digit-normalised to 0-9** before the look-up (`WELCOME١٠` matches
  `WELCOME10`), then upper-cased — on `POST /orders` and
  `POST /discount-codes/validate`.

Glossary gained the statement / PDF label vocabulary (8 languages). No new
endpoint, permission or schema change. **Verified**: in Swahili the
dashboard's recent orders read `Maharage Mbegu — 10kg Mfuko`, statement rows
`ankara` / `malipo`, the statement PDF header `Taarifa ya Akaunti … Tarehe /
Aina / Kumbukumbu / Kiasi / Salio Linaloendelea` (French: `Relevé de
compte …`); `WELCOME١٠` matched `WELCOME10`.

---

## OpenAPI / Swagger API documentation (29 August 2026)

`09_API Specification` always described itself as "a build-ready
specification, not a finished OpenAPI/Swagger contract". That contract now
exists and is **generated from the running backend**, not hand-written.

- **Swagger UI** (interactive, "Try it out") at
  **`http://localhost:3001/api/v1/docs`**; the raw **OpenAPI 3 document** at
  **`/api/v1/docs-json`**; a committed snapshot at **`mbms/backend/openapi.json`**
  (refresh with `npm run openapi:generate` against a running server).
- Wired with **`@nestjs/swagger`** in `mbms/backend/src/main.ts` and its **CLI
  plugin** in `nest-cli.json`, so request/response schemas come straight from
  the existing `class-validator` DTOs — **245 paths / 309 operations / 116
  schemas** at the time of writing, with **no** `@ApiProperty` decorators
  added.
- Two bearer schemes, **`staff`** and **`customer`**, matching the two JWT
  audiences in `.env`. Click **Authorize** and paste a token from
  `POST /identity/auth/login` or `POST /customer-portal/auth/login`.
- **Build requirement:** the plugin only runs through `nest build` /
  `nest start` (not bare `tsc`), so the backend must be built with
  `npm run build` (clear `tsconfig.tsbuildinfo` first). New dependencies:
  `@nestjs/swagger`, `@fastify/static`.
- No endpoint, response-envelope, error-code or schema change; documentation
  only. Full detail in `mbms/README.md`, "OpenAPI / Swagger API
  documentation".

---

## Corporate landing page & public mini-site (29 August 2026)

The Customer Storefront's pre-login landing page is **redesigned as a small
public holding-company site**. The layouts follow the reference mockups in
`screenshots/files(13)/*.html`; the **styling matches the shop page** — the
storefront design system (`storefront.css`): system fonts, the navy
`#1E3A5F` / blue `#2E5395` / amber `#D97706` palette, `#F2F5FA` background
and white 10px cards. (The mockups' "paper & bronze" Fraunces / IBM Plex
Mono treatment was the first cut and has been dropped; no web fonts are
loaded.)

- **Seven public routes**, none behind auth: `/` (holding-company landing —
  hero, live figure strip, Companies grid, letter-to-shareholders band),
  `/companies`, `/companies/:id`, `/profile`, `/governance/board`,
  `/investors/overview`, `/investors/news`, `/contacts`. The public CMS
  content pages `/page/:slug` (About / Terms / Delivery) render in the same
  `CorporateLayout` shell and styling.
- **One new backend endpoint** — `GET /api/v1/customer-portal/public/overview`
  — **public, no token**. Returns the holding company, its active
  subsidiaries (with branches + ownership) and roll-up group figures
  (subsidiaries, branches, catalogue items, categories); honours
  `Accept-Language`. **No schema or migration change** — reuses the
  group-catalogue resolution, generalised to take no customer
  (`CustomerCatalogService.listGroupOverview`), behind a new unguarded
  `CustomerPublicController`.
- The Companies grid, per-company pages and Group Overview table are
  populated **live** (4 subsidiaries, 14 branches, 24 catalogue items).
  Sector labels / blurbs are presentation-only (keyed by name, generic
  fallback); group leadership and news are labelled illustrative demo data.
- A **signed-in customer is unaffected** — `/` still shows the dashboard;
  the authenticated storefront's look is unchanged. A signed-out visitor
  meets the **full-page demonstration-disclaimer gate first** (10-second
  hold, admin-managed statements — see below); the demo-strip "Read
  disclaimer" re-opener remains on every corporate page.
- Front end: `mbms/storefront/src/styles/corporate.css` (tokens mirror
  `storefront.css`), `components/CorporateLayout.jsx`, `lib/corporate.js`,
  `pages/corporate/*.jsx`, 7 routes in `App.jsx`, `corp.*` keys in
  `locales/en.js` (other languages fall back to English). Full detail in
  `mbms/README.md`, "Corporate landing page & public mini-site".

---

## Full-page disclaimer gate (30 August 2026)

The demonstration disclaimer that used to be a dismissible modal is now a
**full-page gate shown first** to a signed-out visitor, before the landing
page:

- Shown for a **10-second hold** (server-set, returned to the client) with a
  **live countdown** on the button; after it, **"I Understand, Continue"**
  activates and the landing page appears. The acknowledgement is remembered
  per browser (`localStorage`), so a return visitor skips it. Deep links to
  the corporate marketing routes (`/companies`, `/profile`, …) redirect back
  through the gate until acknowledged.
- The disclaimer **statements are admin-managed** — new table
  **`disclaimer_items`** (migration `20260830130000_site_disclaimer`):
  `body`, `sort_order`, `is_visible`. Admin API
  `GET/POST/PATCH/DELETE /api/v1/cms/disclaimer-items` — **no new
  permission**, reuses `cms.viewAll` / `cms.manage`; every write audited.
  Public API `GET /api/v1/customer-portal/public/disclaimer` (no token) →
  `{ holdSeconds, items: [{ id, body }] }` (visible only, admin order,
  `Accept-Language`).
- Admin: a **"Site disclaimer"** panel on the CMS / Site Builder screen
  (add / edit / re-order / show-hide / remove). Storefront: a new
  `DisclaimerGate` component (`App.jsx` `RootPage`); the `CorporateLayout`
  modal is demoted to a "Read disclaimer" re-opener fed by the same
  statements.
- Seeded with 5 statements. Full detail in `mbms/README.md`, "Full-page
  disclaimer gate".
- **Localised (30 August 2026):** the gate's chrome (heading, statements,
  countdown button, hint, "Customer sign in") and the whole corporate
  landing surface render in the visitor's language — the **144 `corp.*` UI
  strings** are translated into the 8 full languages, and the 5 seeded
  disclaimer statements are in the content glossary so
  `/customer-portal/public/disclaimer` returns them translated. First visit
  picks the language from `?lang=<code>` → `navigator.languages` → English.
  Arabic renders right-to-left. See "Pre-login localisation" in
  `mbms/README.md`.

---

## Social media channels (29 August 2026)

An administrator adds the group's **social media channels** in **Admin »
CMS / Site Builder**; they show in the **storefront footer** — both the
pre-login corporate pages and the signed-in customer pages.

- New table **`social_links`** (migration `20260829180000_social_media_links`),
  site-wide: `platform` (enum — Facebook / X / Instagram / LinkedIn /
  YouTube / TikTok / WhatsApp / Telegram / Other), optional `label`, `url`,
  `sort_order`, `is_visible` (hide without deleting).
- **Admin API** under `/api/v1/cms/social-links` (`GET` / `POST` / `PATCH` /
  `DELETE`) — **no new permission**, reuses `cms.viewAll` / `cms.manage`;
  every write audited.
- **Public API** `GET /api/v1/customer-portal/public/social-links` — no
  token; returns the visible channels in admin order.
- Admin: a "Social media channels" panel on the CMS / Site Builder screen
  (add / re-order / show-hide / remove). Storefront: a "Follow us" row in
  the `CorporateLayout` and `Layout` footers; omitted when empty.
- Seeded: Facebook, X, LinkedIn, Instagram (visible) + a hidden WhatsApp.
- Files: `backend/src/cms/social-links.service.ts` + `dto/social-link.dto.ts`,
  `cms.{controller,module}.ts`, `customer-storefront.controller.ts`,
  `frontend/src/pages/Cms.jsx`, `storefront/src/lib/corporate.js` +
  `components/{CorporateLayout,Layout}.jsx`. Full detail in `mbms/README.md`,
  "Social media channels".

---

## Landing-page newsletter & FAQ (29 August 2026)

The corporate **landing page** gains a **Newsletter sign-up band** and an
**FAQ section**. An admin manages the FAQ Q&A in **CMS / Site Builder** and
reviews newsletter sign-ups there.

- Two new tables (migration `20260829200000_landing_faq_newsletter`):
  **`faq_items`** (question / answer / `sort_order` / `is_visible`) and
  **`newsletter_subscribers`** (`email` unique, `status`, `source`).
- **Admin API** `/api/v1/cms/faqs` (`GET`/`POST`/`PATCH`/`DELETE`) and
  `/api/v1/cms/newsletter-subscribers` (`GET` list + counts, `DELETE`) —
  **no new permission**, reuses `cms.viewAll` / `cms.manage`; FAQ writes
  audited.
- **Public API** — no token: `GET /api/v1/customer-portal/public/faqs`
  (visible, admin order, `Accept-Language`) and
  `POST /api/v1/customer-portal/public/newsletter` (`{ email }` →
  `{ subscribed: true }`; **10/min/IP**, idempotent, non-enumerating).
- Admin: "Landing-page FAQ" + "Newsletter sign-ups" panels on the CMS /
  Site Builder screen. Storefront: a navy Newsletter band + an
  expand/collapse FAQ section on the landing page (`Home.jsx`); the FAQ
  section is omitted when empty.
- Seeded: 5 FAQ items (4 visible, 1 hidden). Full detail in `mbms/README.md`,
  "Landing-page newsletter & FAQ".

---

## Morise brand mark (31 August 2026)

Morise now has a real **logo** in place of the plain letter **"M"** that
stood in for a brand mark in both apps.

- **The mark** — a geometric **monoline "M"** that also reads as an
  **upward growth line** and a **route between points** (the group moves
  inputs, fuel, freight and value across sites), with an **amber diamond**
  on its apex for the holding company as the **connecting keystone** of its
  subsidiaries. Colours are the existing tokens: **navy `#1E3A5F`**,
  **amber `#D97706`**, white. One continuous stroke, round caps/joins —
  crisp from a 16 px favicon up.
- **`brand/`** (new, repo root) — `morise-logo.svg` (primary lockup: navy
  tile + `MORISE` wordmark + `HOLDINGS LIMITED` subtitle),
  `morise-logomark.svg` (navy app-tile), `morise-logomark-light.svg` /
  `morise-logomark-dark.svg` (transparent "M" for dark / light grounds),
  and **`brand/README.md`** — a one-page brand sheet (concept, colour
  values, clear-space, minimum sizes, do / don't, file inventory).
- **`src/components/Logo.jsx`** — one shared React component, identical in
  `mbms/frontend` and `mbms/storefront`. The "M" stroke is
  `currentColor`, so a `<Logo/>` dropped into an existing badge takes
  navy-on-white or white-on-navy automatically; the diamond is always
  amber. Props: `size`, `tile`, `tone`.
- Every "M" placeholder now renders `<Logo/>` — Admin top bar + login;
  Storefront shop header, corporate-site nav, the full-page disclaimer
  gate, and the four customer auth screens. Both `index.html` files gained
  an inline **SVG data-URI favicon** of the navy tile mark.
- **Front-end assets + one shared component only** — no backend,
  permission, endpoint, schema or migration change; OpenAPI unchanged.
  Both `vite build`s pass.

---

## Morise banner family (31 August 2026)

A full set of professional **banners** built on the logo's visual
language — navy → blue gradient, the logomark "M" as a faint watermark,
the amber keystone diamond, and a thin **route line** through nodes.

- **`brand/banners/`** (new) — 13 standalone SVGs (no web fonts, no
  external refs):
  - `group-hero.svg` (text baked) + `group-hero-bg.svg` (texture only,
    for use behind live page copy)
  - `page-header-bg.svg` — slim interior-page band
  - `social-card.svg` (1200×630) — Open Graph / social share
  - `email-header.svg` — newsletter header
  - `promo-strip.svg` — storefront promotional strip
  - `announcement-ribbon.svg` — "Demonstration build" notice
  - `auth-side.svg` — sign-in brand panel
  - `subsidiary-{agro,logistics,clearing-forwarding,warehouse,collateral}.svg`
    — one per subsidiary, navy ground + amber diamond + a single
    sector-accent hue
  - usage table in **`brand/README.md`**
- **Wired in (heroes)** — the SVGs are mirrored into
  `mbms/{frontend,storefront}/public/brand/banners/`; the storefront hero
  (`.sf-hero`) and the corporate mini-site hero (`.mc-hero`) layer
  `group-hero-bg.svg` over their navy→blue gradient (gradient kept as a
  fallback); both `index.html` files gained `og:image` / `twitter:image`
  meta pointing at `social-card.svg`.
- **Displayed across the storefront (31 August 2026)** — a
  `bannerFor(name)` helper in `storefront/src/lib/corporate.js` maps each
  subsidiary to its `/brand/banners/subsidiary-*.svg`. The landing-page
  **Companies grid** and the **Companies directory** now show that
  subsidiary's banner on each card (was an empty grey box); the
  **portfolio-company page** shows it as its photo strip; the **subsidiary
  directory** shows the group hero + per-card banners; the **shop** shows
  the promo strip, swapped for the selected subsidiary's banner when the
  company filter is set.
- **Seed (seed-only)** — the storefront promo-banner rail for the demo
  customer's company is now a curated set of **three** text-only
  `PromoBanner` rows, consumed by the existing
  `GET /customer-portal/promo-banners` endpoint (unchanged).
- **Front-end assets + minor CSS + seed data only** — no backend,
  permission, endpoint, schema or migration change; OpenAPI unchanged.
  Both `vite build`s pass; the backend seed type-checks.

---

## Delivery Management System — Morise Logistics Ltd (31 August 2026)

An administrator (the Managing Director) asked for **the concept of
delivery** to be added to the subsidiary **Morise Logistics Ltd** — a
delivery capability that takes **goods, services and invoices** to
customers who have placed orders through the group Customer Storefront,
carrying each order from *ready for delivery* through dispatch and transit
to a recorded **proof of delivery**.

- **New numbered document** `docx/22_Delivery Management System - Feature
  Specification - Morise Holdings Limited.docx`, owning entity **Morise
  Logistics Ltd**. It restates the client attachment
  `docx/Delivery-Software-Feature-Specification.docx` in the same house
  format as docs 19–21 and adds *Organisation as Built* (incl. a new
  **§8.5** listing what is coded today), *Relationship to the Existing
  MBMS Platform* and *Approval*.
- **Ten feature modules** in the spec — customer delivery experience;
  driver / courier app; dispatch & operations console; route planning &
  optimisation; proof of delivery & exceptions; **document & invoice
  delivery**; pricing, zones & delivery fees; fleet & driver management;
  notifications & communication; reporting & analytics — plus NFRs,
  architecture, integration points, user roles and a phased roadmap.
- **Phase 1 back end already built in MBMS** (present before this docs
  pass; recorded here, not written by it):
  - migration **`20260831120000_delivery`** (applied) — tables
    `deliveries`, `delivery_drivers`, `delivery_events`; enums
    `DeliveryStatus` (`pending → assigned → picked_up → in_transit →
    delivered`, `failed`, `cancelled`), `DeliveryKind` (`goods`/`invoice`),
    `DeliveryProofType`
  - **`mbms/backend/src/delivery/`** module wired into `AppModule`;
    `DeliveryService` also consumed by the customer-portal orders module
  - staff API **`/api/v1/delivery`** — 13 routes: deliveries
    list/get/create (from an order, invoice or bare customer;
    `DEL-2026-NNNN`), assign driver, advance status, capture proof (which
    advances the order to `delivered`), fail, cancel, dispatch **metrics**
    (on-time %, avg transit hrs, exceptions, counts by status),
    **eligible-orders** queue, driver list/create/update
  - customer API **`GET /api/v1/customer-portal/orders/:id/delivery`** —
    the customer's own tracking read (status checkpoints, driver, proof)
  - every endpoint scope-checked (`delivery.viewAll` / company scope);
    every mutation written to the audit trail (`delivery.*`)
- **Activated 31 August 2026** — the `delivery.manage` / `delivery.viewAll`
  permission codes are now **in the seed catalogue and granted** (see the
  *"Delivery module activated"* section below), so the `/api/v1/delivery`
  endpoints return **200** for holders (they returned **403** for everyone
  before). Still pending: **no seed data** (no personas / deliveries),
  **no Admin "Delivery" screen** and no storefront tracking view, and
  **`openapi.json` has not been regenerated**. The wider platform (mobile
  apps, route optimisation, the fee engine, telematics, notifications,
  driver analytics) is future scope.
- **Organisation.** Morise Logistics Ltd already exists as a live trading
  subsidiary (Jinja Branch; four priced storefront services incl.
  last-mile delivery **`LOG-2003`**). The delivery hubs, departments and
  policies in doc 22 §8 are *proposed*, creatable under the
  subsidiary-lifecycle capability.
- **Recorded across the set** — `Implementation Status Update 65` (docs
  01–18) / `Update 40` in `morise.docx`, each with a per-document
  *Impact on this document* line (docs 08/09 note the real schema and API
  change); a one-line **Addendum (31 August 2026) — Delivery Management
  System (Doc 22)** on docs 19, 20 and 21; and `Implementation Status Note
  42` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
  Pre-edit copies of every touched file are in `docx_backup54/`.
- **Activation status:** `delivery.manage` / `delivery.viewAll` are seeded
  and granted (**done**, 31 Aug 2026). Still to build: the Admin "Delivery"
  screen + storefront tracking view, seeded demo personas/deliveries, and
  an `openapi.json` regeneration.

---

## Automatic Morise-stamped invoice on customer-acknowledged delivery (31 August 2026)

A customer asked that, once the delivery persona from **Morise Logistics
Ltd** has delivered the goods or services and the **customer has
acknowledged receiving them in good condition**, MBMS automatically issues
a **Morise-stamped invoice** for that order — one branded document that is
the definitive proof of supply and of the customer's acceptance. Added to
**`docx/22`** as an addendum (*"Customer Acknowledgement of Delivery & the
Automatic Morise-Stamped Invoice"*).

- **Flow.** Delivery persona captures proof of delivery (delivery →
  `delivered`, order → `delivered`) → the customer is prompted in the
  storefront to confirm the outcome — *received in good condition*,
  *damaged*, *incomplete*, or *not received* → on **good condition** the
  order's existing invoice is moved to an **issued / stamped** state and a
  **Morise-stamped invoice PDF** is generated and attached; on any other
  outcome **no stamp** is issued, a **delivery exception** is opened
  (doc 22 §2.5) and the invoice stays provisional.
- **The stamp** — the Morise brand mark (the monoline "M" logomark from
  `brand/`, navy `#1E3A5F` / amber `#D97706`) used as a seal, overprinted
  with "DELIVERED · ACKNOWLEDGED", the delivery number and the
  acknowledgement date. The stamped invoice also carries the selling
  subsidiary's details + the Morise Holdings group mark, the line items,
  the delivery details (number, date, driver, proof type) and the customer
  acknowledgement block (name, timestamp, condition, note) — in the
  customer's language.
- **Not a second invoice** — MBMS already creates one invoice per order at
  order time; this adds an *issued / stamped* state and the branded
  document to that same invoice, produced automatically at acknowledged
  delivery. Payment and GL posting are unchanged.
- **Specification only — nothing built** (verified in the codebase
  31 Aug 2026): no customer acknowledgement endpoint, no issued/stamped
  invoice state, and the invoice PDF
  (`mbms/backend/src/common/reports/pdf.util.ts`) is a plain fixed-width
  table with a text footer and **no brand mark**. The Delivery Management
  System back end it builds on is now activated (permissions seeded), but
  the acknowledgement endpoint, the issued/stamped invoice state and the
  branded PDF are all still unbuilt.
- **Recorded across the set** — `Implementation Status Update 66` (docs
  01–18) / `Update 41` in `morise.docx` with a per-document *Impact on
  this document* line each; the doc 22 addendum; a one-line **Addendum
  (31 August 2026) — Stamped Invoice on Acknowledged Delivery (Doc 22)**
  on docs 19, 20 and 21; and `Implementation Status Note 43` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies are in `docx_backup55/`.
- **To build:** switch on the delivery back end; add the acknowledgement
  endpoint (`POST /api/v1/customer-portal/orders/:id/delivery/acknowledge`)
  + a storefront confirm-delivery prompt; add invoice `issuedAt` /
  `stampedAt` / `deliveryId` / `acknowledgedCondition` + a migration; draw
  the Morise stamp + acknowledgement block into the invoice PDF; wire the
  non-good-acknowledgement exception path and notifications; regenerate
  `openapi.json`.

---

## Assigning a Morise Logistics Ltd delivery persona to an order (31 August 2026)

An administrator asked to be able to **assign a delivery persona** (a
driver / courier) from **Morise Logistics Ltd** to deliver the products or
services on an order a customer has placed. Added to **`docx/22`** as an
addendum (*"Admin Assignment of a Morise Logistics Ltd Delivery Persona to
an Order"*), covering §2.3 (Dispatch & Operations Console) and §2.8 (Fleet
& Driver Management).

- **Workflow.** A dispatcher (`delivery.manage`, ordinarily in Morise
  Logistics Ltd): (1) reviews the orders that can still be handed to
  Logistics — a fulfilment-state order (`confirmed` / `packed` /
  `out_for_delivery`), not cancelled, without a delivery yet
  (`GET /api/v1/delivery/eligible-orders`); (2) creates a delivery for the
  order (`POST /api/v1/delivery`, `companyId` = Morise Logistics Ltd,
  `orderId` — customer, origin company, drop address and delivery fee
  resolved from the order); (3) assigns a persona from Morise Logistics
  Ltd's driver pool — on create (`driverId` → `assigned`) or via
  `POST /api/v1/delivery/:id/assign` (`driverId`, optional `scheduledDate`,
  note). A non-terminal delivery can be **reassigned** the same way.
- **The persona pool** — `delivery_drivers` rows scoped to Morise
  Logistics Ltd (name, phone, licence, vehicle reg/type, active flag,
  optional `Employee` link) with CRUD
  (`GET`/`POST /api/v1/delivery/drivers`, `PUT /api/v1/delivery/drivers/:id`)
  and each persona's open-delivery count. Assignment is refused unless the
  persona is **active** and in the **same company** as the delivery.
- **What it does** — sets `driverId`, moves `pending` → `assigned`, stamps
  `assignedAt`, logs a `delivery_events` row, records a
  `delivery.driver_assigned` audit entry. Read-only oversight is
  `delivery.viewAll`; automatic proximity/load selection is future scope
  (assignment today is an explicit dispatcher choice with a manual
  override).
- **Already built in the Phase 1 back end** — `POST /api/v1/delivery`,
  `POST /api/v1/delivery/:id/assign`, the `delivery_drivers` CRUD and
  `GET /api/v1/delivery/eligible-orders`, all scope-checked and audited.
- **Now usable via the API** — `delivery.manage` / `delivery.viewAll` are
  seeded and granted (31 Aug 2026); the assignment flow was verified end to
  end (a delivery created for a storefront order, a Morise Logistics Ltd
  persona assigned, audit recorded). Still pending: **seeded** Morise
  Logistics Ltd personas and the Admin **"Delivery" dispatch screen**.
- **Recorded across the set** — `Implementation Status Update 67` (docs
  01–18) / `Update 42` in `morise.docx` with a per-document *Impact on
  this document* line; the doc 22 addendum; **Addendum (31 August 2026) —
  Assigning a Delivery Persona to an Order (Doc 22)** on docs 19, 20 and
  21; and `Implementation Status Note 44` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies are in `docx_backup56/`.
- **Activation status** — `delivery.manage` / `delivery.viewAll` seeded +
  granted (**done**). Still to do: seed a few Morise Logistics Ltd personas
  and build the Admin dispatch screen.

---

## Delivery module activated (31 August 2026)

The Phase 1 delivery back end (spec `docx/22`; recorded across Updates
65–67) is now **switched on**. Its two permission codes were added to the
seed permission catalogue (`mbms/backend/prisma/seed.ts`, `PERMISSIONS`,
domain `operations`) and granted:

| Permission | Granted to |
|---|---|
| `delivery.manage` + `delivery.viewAll` | Super Administrator, Managing Director, IT Administrator, Operations Manager |
| `delivery.manage` (own company scope) | Branch Manager |
| `delivery.viewAll` (read-only oversight) | Group CEO, Auditor, External Auditor, Board Member, Read-only User |

`delivery.manage` = create a delivery for a customer order, assign /
reassign a delivery persona, advance the lifecycle, capture proof of
delivery, and manage the Morise Logistics Ltd driver pool.
`delivery.viewAll` = group-wide read of every delivery, persona and
dispatch metric.

**Verified end to end.** Signed in as the Managing Director:
`GET /api/v1/delivery`, `/delivery/metrics`, `/delivery/eligible-orders`
and `/delivery/drivers` return **200** (were **403**). A Morise Logistics
Ltd delivery persona was created, a delivery (`DEL-2026-0001`) was created
for a storefront order — customer, drop address and delivery fee resolved
from the order — and the persona was assigned, moving the delivery
`pending → assigned`, stamping `assignedAt`, appending a `delivery_events`
row and recording a `delivery.driver_assigned` audit entry. The
verification rows were then deleted, so **no delivery data is seeded**.

**Seed data + grants only** — no schema, endpoint, migration or
application-code change; the endpoints were already built and wired. This
**supersedes** the "switched off / every `/api/v1/delivery` call returns
403" language in the delivery, stamped-invoice and persona-assignment
sections above and in Updates 65–67. Still pending: seeded Morise Logistics
Ltd delivery personas, an Admin **"Delivery"** dispatch screen (and a
storefront tracking view), and an `openapi.json` regeneration.

Recorded as **doc 22** in-place edits (status line + §8.5) plus an
*"Delivery Module Activated"* addendum; `Implementation Status Update 68`
on docs 01–18 / `Update 43` in `morise.docx` (each with an *Impact*
line); an addendum on docs 19–21; and `Implementation Status Note 45` in
`Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
copies are in `docx_backup57/`.

---

## Customer Storefront wording: Services Catalog / Add to Invoice / Invoice (31 August 2026)

An administrator asked for three wording changes in the **Customer
Storefront**:

| Was | Now |
|---|---|
| Product Catalog | **Services Catalog** |
| Add to Cart *(button / "Added to Cart ✓" / "Add to cart — {branch}")* | **Add to Invoice** |
| Cart *(header link, `Shop / Cart` breadcrumb, `Cart & Checkout` heading, "Your cart is empty", split/discount copy)* | **Invoice** |

- **Front-end string catalogue only.** Updated
  `mbms/storefront/src/locales/en.js` in full — `header.cart`,
  `common.addToCart`, `productDetail.added` / `.addFromBranch`,
  `shop.heading`, `shop.loadFailed`, `cart.crumb` / `.heading` /
  `.emptyLead` / `.browseCatalog` / `.discountSingleCompanyOnly` /
  `.splitNote`, `landing.feat.shop.title`, and the landing hero / step /
  disclaimer prose — plus the matching **already-translated** keys in
  `eu.js` (French, Spanish, Portuguese, German, Italian) and `regional.js`
  (Swahili, Luganda, Arabic in full; Runyankole + Acholi partial), so no
  supported language shows the old wording. The header basket icon changes
  from 🛒 to 🧾.
- **Nothing else changes.** The `/cart` route, the React components
  (`CartPage`, `CartProvider`, `lib/cart.jsx`), the CSS classes and the
  `orders` / `invoices` back end are untouched — an order still creates its
  `Invoice` at order time exactly as before. `t()` **keys** are unchanged;
  only their values were edited. `vite build` passes (73 modules, no
  errors).
- **Recorded across the set** — `Implementation Status Update 69` (docs
  01–18) / `Update 44` in `morise.docx` with a per-document *Impact on
  this document* line; **Addendum (31 August 2026) — Storefront Wording:
  Services Catalog / Add to Invoice / Invoice** on docs 19–21; and
  `Implementation Status Note 46` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup58/`.

---

## Payroll Management feature specification (1 September 2026)

An administrator asked that a **Payroll Management** section be recorded:
one payroll system for employees **across multiple subsidiaries**, with the
21 features below. Most of the transactional core is already built
(*Shift Scheduling & Payroll activated*, 28 August 2026 — `src/payroll/`).
This entry maps each requested feature to the current MBMS state and
records the rest as the Payroll Management backlog.

| Feature | Status | Notes |
|---|---|---|
| Multi-subsidiary support | **Built** | every `PayrollRun` is `companyId`-scoped; `payroll.viewAll` gives group-wide visibility |
| Salary structures | **Built** *(1 Sep 2026)* | `salary_components` per employee; a run derives gross from the applicable components, `Employee.grossSalary` is the fallback |
| Basic salary | **Built** | a `basic` component line (one active recurring `basic` per employee) |
| Allowances | **Built** | `allowance` component lines (recurring) |
| Overtime | **Built** | `overtime` component lines (one-off for a specific month) |
| Bonuses | **Built** | `bonus` component lines (one-off for a specific month) |
| Commissions | **Planned** | not modelled |
| Deductions | **Partial** | `Payslip.otherDeductions` (one manual figure) + advance recovery; no typed deduction catalogue |
| Loans | **Partial** | `SalaryAdvance` (short-term, instalment recovery); no long-term loan with interest / schedule |
| Advances | **Built** | `SalaryAdvance` request → approve / reject → recovering → recovered; auto-recovered by runs |
| Taxes | **Built** | Uganda PAYE bands (`uganda-statutory.util.ts`), per payslip |
| Statutory deductions | **Built** | NSSF 5% employee / 10% employer |
| Pension contributions | **Partial** | NSSF is the statutory pension; no separate voluntary / occupational scheme |
| Payroll approval | **Built** | `PayrollRun` draft → approved (`payroll.approve`) |
| Payslip generation | **Built (data)** | `Payslip` rows + `My Payslips` self-service; **no PDF payslip** yet |
| Bank payment schedules | **Planned** | paying a run posts a GL entry; no bank / EFT payment file or schedule |
| Payroll history | **Built** | `payroll_runs` retained and listable; per-employee history via `My Payslips` |
| Payroll reports | **Planned** | no report endpoint |
| Department payroll reports | **Planned** | no department dimension on the payslip |
| Company payroll reports | **Partial** | a run's totals are a company's monthly figures; no formal report view |
| Consolidated group payroll reports | **Planned** | no cross-company roll-up |

- **Built (Update 41):** monthly `PayrollRun` per subsidiary
  (draft → approved → paid), a `Payslip` per active employee computing
  Uganda PAYE + NSSF from `Employee.grossSalary` less any salary-advance
  instalment and a manual other-deductions figure, a **balanced GL journal
  entry on pay**, employee notification, `SalaryAdvance` with automatic
  recovery, group-wide visibility via `payroll.viewAll`, and the **My
  Payslips** self-service view. Code: `mbms/backend/src/payroll/`
  (`payroll.service.ts`, `payroll.controller.ts`, `uganda-statutory.util.ts`),
  tables `payroll_runs` / `payslips` / `salary_advances`, screen
  `frontend/src/pages/Payroll.jsx`.
- **Built next (1 Sep 2026 — Update 71):** the **salary-structure /
  component model** (basic + allowances + overtime + bonuses). New
  `salary_components` table per employee (`type` basic / allowance /
  overtime / bonus, label, amount, `recurring` flag, `period_year` /
  `period_month` for a one-off line) and a `payslip_components` breakdown
  child table (migration `20260901120000_salary_structures`). A payroll
  run derives each employee's gross from the sum of their applicable
  components (recurring + this month's one-off items), falling back to
  `Employee.grossSalary` when there's no structure; PAYE / NSSF and the GL
  posting are unchanged. New endpoints `GET`/`POST`/`PATCH`/`DELETE
  /api/v1/payroll/salary-components` and `GET
  /api/v1/payroll/salary-structure/:employeeId` (under the existing
  `payroll.manage` / `payroll.viewAll`); the Admin Payroll screen gains a
  **Salary structures** tab and each payslip row expands to its component
  breakdown. Seed adds worked structures for Grace Auma and Peter Kintu.
- **Still backlog:** **commissions**; typed deductions + a long-term loan
  facility; a voluntary pension; a **payslip PDF**; **bank payment
  schedules / EFT file**; and the **reporting suite** — payroll,
  department, company and consolidated group payroll reports.
- **Recorded** as `Implementation Status Update 70` + `71` (docs 01–18) /
  `Update 45` + `46` in `morise.docx`; **Addendum (1 September 2026) —
  Payroll Management Feature Specification** and **Addendum … — Payroll:
  Salary Structures, Allowances, Overtime & Bonuses** on docs 19–21; and
  `Implementation Status Note 47` + `48` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup59/` and `docx_backup60/`.

---

## Accounting & Finance feature section (1 September 2026)

An administrator asked that a **"7. Accounting and Finance"** section be
recorded — the financial module as one of the core components. It is
already the **deepest built area of MBMS** (Sprint 10 *Full Accounting* +
the 19 August 2026 *Financial Module Deepening*); this entry maps the
requested feature list to what is live.

| Area | Feature | Status |
|---|---|---|
| **General Ledger** | Chart of accounts · Journal entries · General ledger · Trial balance · Financial periods · Account reconciliation · Recurring journals | **Built** |
| | Adjusting entries · Closing entries | **Built** (`JournalEntryType` = `standard` / `adjusting` / `closing`; a period close posts the closing entries) |
| **Accounts Receivable** | Customer invoices · Credit notes · Debit notes · Customer payments · Outstanding invoices · Payment reminders · Customer statements · Aging reports | **Built** |
| | Receivable reconciliation | **Partial** — the generic account reconciliation can target the AR control account; no purpose-built AR sub-ledger reconciliation view |
| **Accounts Payable** | Supplier invoices (= purchase invoices) · Supplier payments · Credit notes · Supplier statements · Outstanding bills · Aging reports · Payment schedules · Approval workflows | **Built** (`APInvoiceStatus` draft → pending_approval → approved → paid; `ap.approve`) |
| **Financial Statements** | Profit and Loss · Balance Sheet · Cash Flow Statement · Trial Balance · General Ledger · Statement of Changes in Equity · Budget versus actual · Financial ratios · Management accounts | **Built** — `/accounting/reports/{income-statement, balance-sheet, cash-flow-statement, trial-balance, general-ledger, statement-of-changes-in-equity, budget-vs-actual, financial-ratios, management-accounts}` |

- **Code:** `mbms/backend/src/accounting/` (accounts, journal-entries,
  financial-periods, recurring-entries, reconciliations, budgets, reports),
  `src/accounts-receivable/` (`/ar`), `src/accounts-payable/` (`/ap`),
  `src/finance/` (`/finance/overview`), and the customer-portal invoices /
  payments. Tables: `accounts`, `journal_entries` (+ items, `entry_type`),
  `financial_periods`, `recurring_journal_entries` (+ items),
  `account_reconciliations`, `budgets`, `customer_credit_notes` /
  `customer_debit_notes`, `supplier_invoices` (+ items), `supplier_payments`
  (+ applications), `supplier_credit_notes`, `invoices` / `payments` /
  `payment_allocations`. Permissions: `accounting.manage` /
  `accounting.viewAll` (AR reuses these) and `ap.manage` / `ap.approve` /
  `ap.viewAll`.
- **The one gap:** a dedicated Accounts Receivable sub-ledger
  reconciliation (open customer invoices vs. the GL AR control account).
- **Documentation only** — no code, schema, endpoint, permission or
  migration change. Recorded as `Implementation Status Update 72` (docs
  01–18) / `Update 47` in `morise.docx` with a per-document *Impact* line;
  **Addendum (1 September 2026) — Accounting & Finance Feature Section**
  on docs 19–21; and `Implementation Status Note 49` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup61/`.

---

## Cash & Bank Management feature section (1 September 2026)

An administrator asked that a **"Cash and Bank Management"** section be
recorded (12 features). There is **no dedicated Cash & Bank module** yet;
this entry maps each feature to what the built General Ledger already
provides.

| Feature | Status |
|---|---|
| Bank account management | **Partial** — a bank account is a GL `Account` with `accountSubType: bank`, managed via `/accounting/accounts`; no bank-specific register (bank name / number / currency / branch / opening balance) |
| Cash accounts | **Partial** — same, `accountSubType: cash` |
| Bank deposits · Bank withdrawals · Transfers | **Partial** — recorded today as a manual balanced **journal entry** against the bank / cash accounts; no one-step deposit / withdraw / transfer action |
| Bank reconciliation | **Built** — `AccountReconciliation` + `/accounting/reconciliations` (+ `/:id/reconcile`): ledger balance vs. statement balance, variance, `open → reconciled`, pointed at a bank account |
| Cash reconciliation | **Built** — the same mechanism pointed at a cash account (no denomination / cash-count sheet) |
| Cash position reports | **Partial** — the dashboard `financials` and `/finance/overview` expose `bankBalances` (cash & bank totals) group-wide; no dedicated cash-position report by account / date |
| Petty cash | **Planned** — no float / imprest / top-up / drawdown model |
| Payment vouchers · Receipt vouchers | **Planned** — payments are recorded (`Payment` / `SupplierPayment` / expense pay) but there are no printable, approved voucher documents |
| Cash-flow forecasting | **Planned** — `/accounting/reports/cash-flow-statement` and the dashboard's trailing-6-month series are historical; no forward projection |

- **Built now:** bank / cash **reconciliation** (`src/accounting/reconciliation/`)
  and the group **cash-position figures** (`src/dashboard/dashboard.service.ts`
  `bankBalances`, `src/finance/`).
- **Backlog:** a purpose-built bank / cash account **register**; **petty
  cash** (float + transactions); one-step **deposit / withdrawal /
  transfer** actions that post the journal entry; **payment / receipt
  vouchers**; **cash-flow forecasting**; and a dedicated **cash-position
  report**.
- **Documentation only** — no code, schema, endpoint, permission or
  migration change; the built ledger and reconciliation are unchanged.
  Recorded as `Implementation Status Update 73` (docs 01–18) / `Update 48`
  in `morise.docx` with a per-document *Impact* line; **Addendum
  (1 September 2026) — Cash & Bank Management Feature Section** on docs
  19–21; and `Implementation Status Note 50` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup62/`.

---

## Budget Management feature section (1 September 2026)

An administrator asked that a **"Budget Management"** section be recorded
(13 features). Budgeting is **partly built** in the General Ledger; this
entry maps each feature to what's live.

| Feature | Status |
|---|---|
| Company budgets | **Built** — `Budget` (one amount per GL `Account` per `FinancialPeriod`), `GET`/`POST /accounting/budgets` (upsert; every change audited) |
| Project budgets | **Built** — `Project.budget` with a budget-vs-actual-cost variance on the project summary (`src/projects/`) |
| Budget versus actual | **Built** — `GET /accounting/reports/budget-vs-actual` (budgeted · actual from posted journals · variance · variance %); also inside `management-accounts` |
| Budget utilization | **Partial** — actual / budgeted % is derivable from budget-vs-actual (and the project summary); no dedicated utilization report |
| Budget revisions | **Partial** — setting a budget upserts the amount and audits the previous → new value (a change trail); no versioned "original vs revised" record |
| Variance analysis | **Partial** — budget-vs-actual gives the variance + %; no favourable / unfavourable classification, drill-down or commentary |
| Annual budgets · Capex budgets · Opex budgets | **Partial** — a `Budget` line on a fiscal-year period / an asset (capex) / an expense (opex) account; no first-class annual / capex / opex concept |
| Department budgets | **Planned** — `Budget` has no `department_id` dimension |
| Group budgets | **Planned** — no cross-subsidiary budget roll-up (`budget-vs-actual` is single-company) |
| Budget approval | **Planned** — `Budget` has no draft → approved workflow |
| Budget alerts | **Planned** — no overspend threshold alerting (no configurable alert-rule engine) |

- **Built now:** `mbms/backend/src/accounting/budgets/` (Budget upsert),
  `src/accounting/reports/` (budget-vs-actual, management-accounts),
  `src/projects/` (project budgets).
- **Backlog:** a **department** dimension and a **capex / opex** tag; a
  first-class **annual** budget; a **group** roll-up; a budget **approval
  workflow** + versioned **revisions**; a dedicated **utilization** report;
  **budget alerts**; and a deeper **variance analysis** view.
- **Documentation only** — no code, schema, endpoint, permission or
  migration change; the built `Budget` model and budget-vs-actual report
  are unchanged. Recorded as `Implementation Status Update 74` (docs
  01–18) / `Update 49` in `morise.docx` with a per-document *Impact* line;
  **Addendum (1 September 2026) — Budget Management Feature Section** on
  docs 19–21; and `Implementation Status Note 51` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup63/`.

---

## Sales Management feature section (1 September 2026)

An administrator asked that a **"Sales Management"** section be recorded —
**Customer Management**, **Sales** and **CRM**. Customer Management and the
order‑to‑cash core are built; quoting, returns, incentives and the whole
CRM are backlog.

| Group | Feature | Status |
|---|---|---|
| **Customer Management** | Customer registration · profiles · categories · payment terms · history · statements | **Built** — `Customer` model + `/customers` (staff) + storefront self‑registration (Google‑linked); `GET /customers/:id/statement`, `/ar/statement`, storefront statement + PDF |
| | Customer contacts | **Partial** — one `contact_email` / `contact_phone`; no multi‑contact list |
| | Customer credit limits | **Partial** — `Customer.credit_limit` stored & editable but **not enforced** at order time |
| **Sales** | Sales orders · Invoices · Credit notes · Discounts · Promotions | **Built** — `Order` status machine (`/sales/orders`), `Invoice` per order, `CustomerCreditNote` (`/ar/credit-notes`), `DiscountCode` + `PromoBanner` (`/marketing`) |
| | Delivery notes · Receipts | **Partial** — the fulfilment status machine + the Delivery module (proof of delivery); customer `Payment` records — no printable delivery‑note / receipt document |
| | Quotations · Sales returns | **Planned** — no quotation model; a return is only a credit note today |
| | Sales commissions · Sales targets · Sales performance | **Planned** — not modelled; the "Sales Performance" dashboard tile is deliberately deferred |
| **CRM** | Customer complaints · Customer feedback · Customer interactions · Emails | **Partial** — `SupportTicket` (category, priority, `open → resolved`) + `ticket_messages` is the complaint / feedback / interaction channel; no general activity log |
| | Leads · Opportunities · Follow‑ups · Calls · Meetings · Sales pipeline | **Planned** — no CRM module (the "Customers (CRM)" nav label is the customer list) |

- **Built now:** `mbms/backend/src/customers/`, `src/sales/`,
  `src/customer-portal/` (orders / invoices / payments / auth),
  `src/marketing/`, `src/support/`, `src/delivery/`; screens Customers,
  Order Management, Marketing & Promos, Support Tickets.
- **Backlog:** a multi‑contact list + an enforced credit‑limit check;
  **quotations** (+ convert‑to‑order); a **sales‑return / RMA** flow;
  printable **delivery notes** and **receipts**; **sales commissions /
  targets / performance**; and the whole **CRM** (leads → opportunities →
  pipeline, an activity log for calls / emails / meetings, follow‑ups,
  structured feedback).
- **Documentation only** — no code, schema, endpoint, permission or
  migration change. Recorded as `Implementation Status Update 75` (docs
  01–18) / `Update 50` in `morise.docx` with a per-document *Impact* line;
  **Addendum (1 September 2026) — Sales Management Feature Section** on
  docs 19–21; and `Implementation Status Note 52` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup64/`.

---

## Procurement & Purchasing feature section (1 September 2026)

An administrator asked that a **"Procurement and Purchasing"** section be
recorded (11 features + the end‑to‑end workflow *Employee/Department
Request → Department Approval → Procurement → Supplier Quotations →
Evaluation → Management Approval → Purchase Order → Delivery → Inspection
→ Invoice → Payment*). There is **no dedicated Procurement module** (a
deliberately deferred Phase‑2 area); only the **supplier master** and the
**Accounts Payable tail** of the workflow are built.

| Feature | Status |
|---|---|
| Supplier invoices | **Built** — `SupplierInvoice` (+ items), `/ap/invoices`, payments, credit notes, aging, statement, payment schedule |
| Purchase approvals | **Partial** — the AP `SupplierInvoice` has a `submit-for-approval → approve` workflow (`ap.approve`, GL posted on approve); no requisition / PO approval chain |
| Purchase returns | **Partial** — recorded today only as a supplier credit note (`SupplierCreditNote`, `/ap/credit-notes`) |
| Procurement budgets | **Partial** — a `Budget` line on the relevant expense / asset account + budget‑vs‑actual; no procurement‑specific budget |
| Procurement reports | **Partial** — AP aging / statement / payment‑schedule; no spend‑by‑supplier / PO‑status reporting |
| Purchase requisitions · Purchase orders · Supplier quotations · Request for quotations · Supplier comparison · Goods received notes | **Planned** — no requisition / PO / RFQ / quotation / comparison / GRN model (and no inbound‑goods / inventory model for the GRN + inspection step) |

- **Built now:** `mbms/backend/src/suppliers/` (Supplier + blacklist) and
  `src/accounts-payable/` (`/ap`); the Procurement Manager role already
  carries `supplier.manage` / `ap.manage` / expense approval.
- **Backlog (the request‑to‑PO front of the process):** a Purchase
  Requisition with a department‑approval step; an RFQ to multiple
  suppliers; Supplier Quotations with a side‑by‑side comparison and an
  evaluation / award; a Purchase Order with a management‑approval chain; a
  Goods Received Note + inspection; a distinct Purchase Return / debit‑note
  flow; a three‑way match (PO ↔ GRN ↔ invoice); and procurement budgets /
  reports. The workflow itself is already described in
  **`05_Business Process Document`, §6.5**.
- **Documentation only** — no code, schema, endpoint, permission or
  migration change; the supplier master and Accounts Payable are
  unchanged. Recorded as `Implementation Status Update 76` (docs 01–18) /
  `Update 51` in `morise.docx` with a per-document *Impact* line;
  **Addendum (1 September 2026) — Procurement & Purchasing Feature
  Section** on docs 19–21; and `Implementation Status Note 53` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup65/`.

---

## Supplier Management feature section (1 September 2026)

An administrator asked that a **"Supplier Management"** section be recorded
(13 features). The **supplier master is built**; this entry maps each
feature to what's live.

| Feature | Status |
|---|---|
| Supplier registration · profiles · categories | **Built** — `Supplier` model + `POST`/`GET`/`PATCH /suppliers` (`supplier.manage`, audited); `filter[category]` |
| Tax information · Bank details | **Built** — `tax_id`, `bank_name`, `bank_account_number` on the record; the account number is **masked** unless the caller holds `supplier.view.sensitive` |
| Supplier payment history · Supplier statements | **Built** — `GET /api/v1/ap/statement?companyId=&supplierId=` (chronological invoice / payment / credit-note ledger with a running balance) |
| Supplier blacklist | **Built** — `POST /suppliers/:id/blacklist` + `/unblacklist`; `SupplierStatus` = `active` / `inactive` / `blacklisted` |
| Supplier suspension | **Built** (1 Sep 2026) — `POST /suppliers/:id/suspend` (reason + optional auto‑lift date) + `/unsuspend`; `SupplierStatus` gains `suspended`; a past‑dated suspension auto‑lifts on read; 409 if the supplier is blacklisted |
| Supplier contacts | **Built** (1 Sep 2026) — `supplier_contacts` (name, title, email, phone, `is_primary`, note); `GET`/`POST /suppliers/:id/contacts`, `PATCH`/`DELETE /suppliers/:id/contacts/:contactId`; one primary enforced |
| Supplier contracts · Supplier documents | **Partial** — a text `contract_reference` + `contract_expiry_date`; no uploaded / versioned files (the deferred object‑storage gap) |
| Supplier evaluation · Supplier performance | **Built** (1 Sep 2026) — `supplier_evaluations` (five 1–5 criteria + averaged overall); `GET`/`POST /suppliers/:id/evaluations`, `DELETE …/:evaluationId`; `GET /suppliers/:id/performance` (rating band, trend, per‑criterion averages, AP position — computed, no table) |

- **Built now:** `mbms/backend/src/suppliers/` (Supplier CRUD,
  sensitive‑field masking, blacklist / unblacklist),
  `src/accounts-payable/` (the supplier statement); screen Suppliers.
- **Backlog:** a **multi‑contact list**; supplier **contracts** and
  **documents** as uploaded versioned files; a **time‑bound suspension**
  distinct from blacklist; and **supplier evaluation / performance**
  (on‑time delivery, quality, price scorecard + rating history).
- **Documentation only** — no code, schema, endpoint, permission or
  migration change; the supplier master is unchanged. Recorded as
  `Implementation Status Update 77` (docs 01–18) / `Update 52` in
  `morise.docx` with a per-document *Impact* line; **Addendum (1 September
  2026) — Supplier Management Feature Section** on docs 19–21; and
  `Implementation Status Note 54` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup66/`.

---

## Supplier Management — Contacts, Suspension & Evaluation implemented (1 September 2026)

The Supplier Management backlog from the section above is now **built as
code** — a multi‑contact list, a time‑bound suspension distinct from
blacklist, and supplier evaluation with a derived performance summary.

- **Schema / migration `20260901130000_supplier_management`:**
  - `supplier_contacts` — several named people per supplier (`name`,
    `title`, `email`, `phone`, `is_primary`, `note`); the service keeps at
    most one primary, demoting the previous one when a new primary is set.
  - `supplier_evaluations` — a periodic scorecard: `period_label`, five
    `1–5` criterion scores (on‑time **delivery**, **quality**, **price**,
    **communication**, **compliance**), an `overall_score` that is their
    average, `comments`, `evaluated_by`.
  - `SupplierStatus` gains **`suspended`**; `suppliers` gains
    `suspension_reason` and `suspended_until`.
- **Endpoints** (under the existing `supplier.manage` / `supplier.viewAll`;
  `supplier.view.sensitive` still governs unmasked bank / tax — **no new
  permission**):
  - `GET` / `POST /api/v1/suppliers/:id/contacts`,
    `PATCH` / `DELETE /api/v1/suppliers/:id/contacts/:contactId`
  - `POST /api/v1/suppliers/:id/suspend` (`{ reason, until? }`) +
    `POST /api/v1/suppliers/:id/unsuspend` — refuses a **blacklisted**
    supplier (`409`); a suspension whose `suspended_until` has passed
    **auto‑lifts on read**
  - `GET` / `POST /api/v1/suppliers/:id/evaluations`,
    `DELETE /api/v1/suppliers/:id/evaluations/:evaluationId`
  - `GET /api/v1/suppliers/:id/performance` — a **derived** summary
    (evaluation count, overall average, rating band **Excellent / Good /
    Fair / Poor**, trend vs the previous scorecard, per‑criterion
    averages, and the supplier's AP position: invoices, paid / overdue
    counts, invoiced / paid / outstanding); **no backing table**.
- **Audit:** `supplier.contact.created` / `updated` / `deleted`,
  `supplier.evaluation.created` / `deleted`, `supplier.record.updated` for
  suspend / unsuspend; bank / tax values stay out of event payloads. All
  routes are company‑scoped exactly like `GET /suppliers/:id`.
- **Admin (`mbms/frontend/src/pages/Suppliers.jsx`):** the supplier name
  opens a **detail dialog** with **Contacts**, **Evaluations** and
  **Performance** tabs and a **Suspend / Lift‑suspension** control;
  add‑contact, new‑evaluation (1–5 sliders with a live overall) and
  suspend (reason + auto‑lift date) dialogs; a `suspended` badge with the
  lift date in the list.
- **Seed:** three contacts + two quarterly scorecards (Q1 / Q2 2026) for
  **AgroChem Uganda Ltd**.
- **Still backlog:** supplier **contracts** and **documents** as uploaded
  versioned files — the deferred object‑storage gap carried for company
  logos and employee documents.
- Verified end to end (seeded data reads back; primary‑contact demotion;
  suspend → unsuspend; a new scorecard moves the average and trend; `409`
  on suspending a blacklisted supplier; `403` on every mutation without
  `supplier.manage`). `nest build` + admin `vite build` clean. Recorded as
  `Implementation Status Update 78` (docs 01–18) / `Update 53` in
  `morise.docx` with a per-document *Impact* line; **Addendum (1 September
  2026) — Supplier Management: Contacts, Suspension & Evaluation** on docs
  19–21; and `Implementation Status Note 55` in
  `Multi_Holdings_Limited_Software_Development_Procedures.docx`. Pre-edit
  copies in `docx_backup67/`.

---

## Running the system

Full instructions are in **`mbms/README.md`**. In short:

```bash
# 1. Infra
cd mbms && docker compose up -d           # Postgres :5442, Redis :6390

# 2. Backend  (NestJS + Prisma, http://localhost:3001/api/v1)
cd backend
npm install
npx prisma generate && npx prisma migrate deploy && npm run prisma:seed
rm -f tsconfig.tsbuildinfo && npx nest build && node dist/main.js
#   API http://localhost:3001/api/v1  ·  Swagger UI /api/v1/docs

# 3. Admin app        → http://localhost:5173
cd ../frontend && npm install && npm run dev

# 4. Customer storefront → http://localhost:5174
cd ../storefront && npm install && npm run dev
```

Seeded demo accounts (local dev only) are listed on the Admin login screen
and in `mbms/README.md`; password for all is `Passw0rd!23`. Every seeded staff
login is linked to an employee record, so the **My HR** self-service screens
work for any of them.

> Backend note (see project memory): `nest start --watch` races on
> `dist/main.js` in this environment — use a one-shot `nest build` +
> `node dist/main.js` and restart manually after backend changes.

### Troubleshooting — "Request failed (500)" on a screen

The admin app shows `Request failed (500).` whenever an `/api/v1/...` call
returns a 500 with no error body. In this project that almost always means
**the backend is stale or down**, not a bug in the screen:

| Symptom | Cause | Fix |
|---|---|---|
| **Every** screen 500s / "Network Error" | Backend process not running (the Vite dev server proxies `/api` and returns 500 when `localhost:3001` refuses the connection) | `cd mbms/backend && node dist/main.js` |
| Only the **newly-activated** screens 500 (e.g. Marketing & Promos, CMS / Site Builder, Inventory) while older screens work | Backend running an **old `dist/` build** or a **DB without the latest migration** — `prisma.discountCode` / the `discount_codes`, `promo_banners`, `content_blocks` tables don't exist yet | `cd mbms/backend && npx prisma migrate deploy && npx prisma generate && rm -rf dist && npx nest build && node dist/main.js` |
| A screen 500s right after `prisma migrate reset` | Old JWT in the browser from before the reseed | Sign out and back in (`Passw0rd!23`) |

After any backend source or `schema.prisma` change: **re-run the migration,
regenerate the client, rebuild, and restart** — the four steps above, in that
order. The Marketing / CMS / Inventory modules were verified returning `200`
end-to-end once the migration `20260828160000_marketing_promos_cms` (and
`20260828120000_inventory_stock_movements`) is applied.

---

## Documentation set (`docx/`)

The document set is **22 numbered documents** plus `morise.docx` and
`Multi_Holdings_Limited_Software_Development_Procedures.docx`. Docs **19**
(*Clearing, Forwarding and Logistics System — Feature Specification*),
**20** (*Warehouse Management System (WMS) — Feature Specification*),
**21** (*Multi-Site Collateral Management System — Feature Specification*,
new 30 August 2026, restating the client attachment
`Multi-Site-Collateral-Management-System-Feature-Specification.docx` in the
house format) are subsidiary-system specs, not built. **22** (*Delivery
Management System — Feature Specification*, new 31 August 2026, owning
entity Morise Logistics Ltd, restating the client attachment
`Delivery-Software-Feature-Specification.docx`) is also a subsidiary-system
spec, but a **Phase 1 back end for it is already coded in MBMS**
(migration `20260831120000_delivery` + `src/delivery/` module + staff /
customer APIs) — currently switched off, permissions not seeded (see doc
22 §8.5). The numbered docs are maintained with an **append-only status
log**: each significant change adds a dated `Implementation Status Update
(DATE)` heading rather than rewriting the body. **Fifty-two** 27 August – 1 September
2026 changes are recorded that way across docs 01–18 and `morise.docx`
(docs 19–22 carry one-line addenda but no full status log):

1. `… — Admin Navigation Redesign` (Update 26)
2. `… — Delegated Administration (Grant Authority)` (Update 27)
3. `… — Permission-Based Visibility (Hide Unpermitted Operations)` (Update 28)
4. `… — Customer Storefront Localisation (Uganda Languages)` (Update 29)
5. `… — Storefront Localisation Extended to World Languages` (Update 30)
6. `… — Full Storefront Localisation (Every Screen)` (Update 31)
7. `… — Database Content Localisation (Read in Language, Store in English)` (Update 32)
8. `… — Currency & Figure Localisation (Convert for Display, Store Canonical)` (Update 33)
9. `… — Subsidiary Lifecycle & Clearing / Forwarding Subsidiary` (Update 34) — plus new doc 19
10. `… — Warehouse Management Subsidiary` (Update 35) — plus new doc 20
11. `… — Inventory Section Activated` (Update 36; Update 11 in `morise.docx`)
12. `… — Marketing & Promos and CMS / Site Builder Activated` (Update 37; Update 12 in `morise.docx`)
13. `… — Managing Director Full Control of Marketing & CMS` (Update 38; Update 13 in `morise.docx`)
14. `… — Localisation Extended to Promo Banners & CMS Content` (Update 39; Update 14 in `morise.docx`)
15. `… — HR Dashboard & Departments Sections Activated` (Update 40; Update 15 in `morise.docx`)
16. `… — Shift Scheduling & Payroll Sections Activated` (Update 41; Update 16 in `morise.docx`)
17. `… — My HR Self-Service Sections Activated` (Update 42; Update 17 in `morise.docx`)
18. `… — Demo Staff Logins Linked to Employee Records` (Update 43; Update 18 in `morise.docx`)
19. `… — Financial & Accounting Overview Activated` (Update 44; Update 19 in `morise.docx`)
20. `… — Customer Sign-Up, Multi-Identifier Login & Password Reset` (Update 45; Update 20 in `morise.docx`)
21. `… — One Storefront Across Every Subsidiary and Its Branches` (Update 46; Update 21 in `morise.docx`)
22. `… — Clearing / Forwarding and Warehouse-Management Catalogues Added to the Group Storefront` (Update 47; Update 22 in `morise.docx`)
23. `… — Content Localisation Extended to the Group Storefront (Read in Chosen Language, Store Input in English)` (Update 48; Update 23 in `morise.docx`)
24. `… — OpenAPI / Swagger API Documentation for the Phase 1 Backend` (Update 49; Update 24 in `morise.docx`) — plus a platform-API-docs addendum on docs 19 and 20 and `Implementation Status Note 26` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
25. `… — Corporate Landing Page & Public Holding-Company Mini-Site` (Update 50; Update 25 in `morise.docx`) — plus a group-public-site addendum on docs 19 and 20 and `Implementation Status Note 27` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
26. `… — Corporate Landing Page Restyled to the Storefront Design System` (Update 51; Update 26 in `morise.docx`) — CSS-only; the corporate pages now match the shop page (navy/white/amber, system fonts). Addendum on docs 19 and 20 and `Implementation Status Note 28` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
27. `… — Public Content Pages Folded Into the Corporate Site Chrome` (Update 52; Update 27 in `morise.docx`) — front-end only; `/page/:slug` (About / Terms / Delivery) now render in `CorporateLayout` with the shared styling. Addendum on docs 19 and 20 and `Implementation Status Note 29` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
28. `… — Social Media Channels — Managed in Admin, Shown in the Storefront` (Update 53; Update 28 in `morise.docx`) — new `social_links` table + migration; `/cms/social-links` CRUD (reuses `cms.*`) and public `/customer-portal/public/social-links`; admin panel + storefront footer row. Addendum on docs 19 and 20 and `Implementation Status Note 30` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
29. `… — Landing-page Newsletter Sign-up and FAQ Section` (Update 54; Update 29 in `morise.docx`) — new `faq_items` + `newsletter_subscribers` tables + migration; `/cms/faqs` + `/cms/newsletter-subscribers` (reuse `cms.*`) and public `/customer-portal/public/{faqs,newsletter}` (POST rate-limited); admin FAQ + sign-ups panels, landing-page newsletter band + FAQ accordion. Addendum on docs 19 and 20 and `Implementation Status Note 31` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
30. `… — Content Localisation Completed — Orders & Payments` (Update 55; Update 30 in `morise.docx`) — order reads honour `Accept-Language` (line items, subsidiary name, cancellation reason); the cancel reason is stored English + original (`orders.cancellation_reason_original` / `cancellation_source_language`, migration `20260829210000…`); payment `reference` digits normalised to 0-9. No new endpoint/permission. Addendum on docs 19 and 20 and `Implementation Status Note 32` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
31. `… — Content Localisation Final Edges (Dashboard, Account Statement & Exported PDFs, Discount-Code Input)` (Update 56; Update 31 in `morise.docx`) — `dashboard-summary` recent orders, `invoices/statement` `typeLabel`, and the statement / invoice **PDFs** honour `Accept-Language` (Latin scripts + digit transliteration; non-Latin PDF labels stay English — font-embedding follow-up); a typed discount code is digit-normalised before matching. Glossary + `content-glossary.ts`; storefront `downloadFile` sends `Accept-Language`. No new endpoint/permission/schema. Addendum on docs 19 and 20 and `Implementation Status Note 33` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
32. `… — Collateral Management Subsidiary + Multi-Site Collateral Management System Specification (New Doc 21)` (Update 57; Update 32 in `morise.docx`) — **new subsidiary** *Morise Collateral Management Ltd* (collateral management agent) seeded (company `…006`, 6 sites, 9 departments, 6 policies) + **new doc 21**. Seed-only; no code/schema/permission change; group figures → 5 subsidiaries / 20 branches. Addendum on docs 19 and 20 and `Implementation Status Note 34` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
33. `… — Full-page Demonstration-Disclaimer Gate (10-second Hold) + Admin-Managed Disclaimer Statements` (Update 58; Update 33 in `morise.docx`) — the demo disclaimer is now a **full-page gate shown first** for 10 s (server-set) with a countdown before "I Understand, Continue" and the landing page; statements are **admin-managed** — new `disclaimer_items` table + migration `20260830130000…`, `/cms/disclaimer-items` CRUD (reuses `cms.*`) and public `GET /customer-portal/public/disclaimer`; admin "Site disclaimer" panel; storefront `DisclaimerGate` component. Addendum on docs 19–21 and `Implementation Status Note 35` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
34. `… — Disclaimer Gate & Corporate Landing Pages Localised into the Chosen Language` (Update 59; Update 34 in `morise.docx`) — the 144 pre-login `corp.*` UI strings translated into the **8 full languages** (`eu.js` + `regional.js`); the 5 seeded disclaimer statements added to `content-glossary.ts` so `/customer-portal/public/disclaimer` translates them; first-visit language from `?lang=` → `navigator.languages` → English; `[dir='rtl']` block for Arabic. Front-end + glossary only. Addendum on docs 19–21 and `Implementation Status Note 36` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
35. `… — Morise Collateral Management Ltd — Priced Services Catalogue Added to the Group Storefront` (Update 60; Update 35 in `morise.docx`) — **10 priced services** (CMC-5001–CMC-5010, 5 categories, 6 sites) seeded from the client's `Collateral-Management-Company-Services-Catalog.docx`; subsidiary gets its own 6-account chart + FY2026-Q1; glossary gains 5 category phrases + ~25 tokens. Seed-only; group → 34 products / 18 categories. Doc 21 gains a **"Services Catalogue"** addendum; cross-ref addendum on docs 19–20 and `Implementation Status Note 37` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
36. `… — Managing Director — Full Operational Authority Across Every Admin Category` (Update 61; Update 36 in `morise.docx`) — the **Managing Director role gets the full 53-permission catalogue** (Super-Admin breadth + `identity.user.delegate`); **16 admin pages** switch their in-screen manage/approve/create gate from a bare role list to `hasRole(…) || hasPermission('…')`. Seed + front-end gating only; no new permission/endpoint/schema. Addendum on docs 19–21 and `Implementation Status Note 38` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
37. `… — Morise Brand Mark — Professional Logo Across Both Apps` (Update 62; Update 37 in `morise.docx`) — a real **logo** (monoline "M" + amber apex diamond, navy `#1E3A5F` / amber `#D97706`) replaces the placeholder letter: new **`brand/`** folder (4 SVGs + brand sheet) and a shared **`src/components/Logo.jsx`** (identical in both apps, "M" inherits `currentColor`) wired into the Admin chrome/login and the Storefront header, disclaimer gate and auth screens; inline SVG data-URI favicons. Front-end assets only; no backend/permission/endpoint/schema change. Addendum on docs 19–21 and `Implementation Status Note 39` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
38. `… — Morise Banner Family — Professional Banner Set Across Both Apps` (Update 63; Update 38 in `morise.docx`) — a **13-SVG banner family** in new **`brand/banners/`** on the logo's visual language: group hero (with / without baked text), interior header, `social-card.svg` (Open Graph), email header, storefront promo strip, "Demonstration build" ribbon, sign-in panel, and one banner per subsidiary. Mirrored into `mbms/{frontend,storefront}/public/brand/banners/`; `.sf-hero` / `.mc-hero` layer `group-hero-bg.svg` over the gradient; both `index.html` gain `og:image` / `twitter:image`; seed curates **3** text-only storefront promo banners. Front-end assets + minor CSS + seed data; no backend/permission/endpoint/schema change. Addendum on docs 19–21 and `Implementation Status Note 40` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
39. `… — Brand Banners Displayed Across the Customer Storefront` (Update 64; Update 39 in `morise.docx`) — the banner family is now **shown on-screen**: a `bannerFor(name)` helper in `storefront/src/lib/corporate.js` drives per-subsidiary `<img>` banners on the landing-page Companies grid, the Companies directory and each portfolio-company page (were empty placeholders); the subsidiary directory gets the group hero + per-card banners; the shop gets the promo strip (or the filtered subsidiary's banner). Storefront front-end only (helper + `<img>` + CSS `.mc-co-photo` / `.mc-photo-strip` / `.sf-*-banner`); no backend/permission/endpoint/schema change. Addendum on docs 19–21 and `Implementation Status Note 41` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
40. `… — Delivery Management System for Morise Logistics Ltd — Specification (New Doc 22) + Phase 1 Back End` (Update 65; Update 40 in `morise.docx`) — **new subsidiary-system spec** *docx/22 — Delivery Management System — Feature Specification*, owning entity **Morise Logistics Ltd**: the concept of **delivery** — taking goods, services and invoices to customers who ordered through the group storefront, from "ready for delivery" through dispatch and transit to a recorded proof of delivery. Ten feature modules, architecture, roles and a phased roadmap, restating the client attachment `Delivery-Software-Feature-Specification.docx`. **A Phase 1 back end is already built in MBMS** (present before this docs pass): migration `20260831120000_delivery` (tables `deliveries` / `delivery_drivers` / `delivery_events` + enums), `src/delivery/` module wired into `AppModule`, a 13-route staff API `/api/v1/delivery` (create from order/invoice, assign, advance, proof→order `delivered`, fail, cancel, metrics, eligible-orders, driver CRUD) and a customer read `GET /customer-portal/orders/:id/delivery`, all scope-checked and audited. Switched off *at the time* — `delivery.manage` / `delivery.viewAll` not seeded (every call 403), no seed data, no UI, `openapi.json` not regenerated; wider platform future scope. **[Superseded by item 43 — the permissions were seeded and granted on 31 Aug 2026; the API is now reachable.]** Docs 08/09 record the real schema + API change. Addendum on docs 19–21 and `Implementation Status Note 42` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`
41. `… — Automatic Morise-Stamped Invoice on Customer-Acknowledged Delivery (Doc 22 Addendum)` (Update 66; Update 41 in `morise.docx`) — a **customer-facing outcome** for the delivery flow: once the Morise Logistics Ltd delivery persona has captured proof of delivery and the **customer acknowledges** receiving the goods/services **in good condition** (proposed `POST /api/v1/customer-portal/orders/:id/delivery/acknowledge`), MBMS **automatically issues a Morise-stamped invoice** for the order — the existing per-order invoice moved to an *issued / stamped* state with a branded PDF bearing the Morise brand mark as a seal plus the delivery + acknowledgement details, in the customer's language. A *damaged / incomplete / not-received* acknowledgement issues **no stamp** and opens a **delivery exception** (doc 22 §2.5). **Specification only — nothing built** (verified 31 Aug 2026: no acknowledgement endpoint, no issued/stamped invoice state, the invoice PDF `common/reports/pdf.util.ts` is a plain table with no logo); depends on the switched-off delivery back end. Recorded as a **doc 22 addendum** + this status-log entry; `Addendum` on docs 19–21 and `Implementation Status Note 43` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`. No code/schema/endpoint/permission/migration change.
42. `… — Admin Assignment of a Morise Logistics Ltd Delivery Persona to an Order (Doc 22 Addendum)` (Update 67; Update 42 in `morise.docx`) — an **administrator** assigns a **delivery persona** (driver / courier) from **Morise Logistics Ltd** to deliver a customer's ordered goods/services. A dispatcher (`delivery.manage`) picks an eligible order (`GET /api/v1/delivery/eligible-orders`), creates a delivery for it (`POST /api/v1/delivery`) and assigns a persona from Morise Logistics Ltd's `delivery_drivers` pool — on create (`driverId`) or via `POST /api/v1/delivery/:id/assign` — with an inactive / wrong-company persona and a terminal delivery **rejected**, `assignedAt` stamped, a `delivery_events` row logged and a `delivery.driver_assigned` audit entry recorded; a non-terminal delivery can be reassigned. **These endpoints + the `delivery_drivers` model are already in the Phase 1 back end** (doc 22 §8.5) but were **switched off** at the time — `delivery.manage` / `delivery.viewAll` not seeded (every call 403), no seeded personas, no dispatch screen. **[Superseded by item 43 — permissions seeded + granted 31 Aug 2026; assignment verified end to end.]** Recorded as a **doc 22 addendum** + this status-log entry; `Addendum` on docs 19–21 and `Implementation Status Note 44` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`. No code/schema/endpoint/permission/migration change.
43. `… — Delivery Module Activated (delivery.manage / delivery.viewAll Seeded & Granted)` (Update 68; Update 43 in `morise.docx`) — the Phase 1 delivery back end (items 40–42) is **switched on**: `delivery.manage` + `delivery.viewAll` added to `prisma/seed.ts` `PERMISSIONS` (domain `operations`) and granted — **manage + viewAll** to Super Administrator, Managing Director, IT Administrator and Operations Manager; **manage** (own scope) to Branch Manager; **viewAll** to Group CEO, Auditor, External Auditor, Board Member and Read-only User. `GET /api/v1/delivery` (+ `/metrics`, `/eligible-orders`, `/drivers`) now **200** (were **403**); verified end to end — a Morise Logistics Ltd persona created, `DEL-2026-0001` created for a storefront order, persona assigned (`pending → assigned`, `assignedAt`, `delivery_events` row, `delivery.driver_assigned` audit); test rows then deleted. **Seed data + grants only** — no schema/endpoint/migration/code change; supersedes the "switched off / 403" language in items 40–42 and Updates 65–67. Still pending: seeded personas, an Admin "Delivery" dispatch screen, an `openapi.json` regeneration. Doc 22 gets in-place edits (status line + §8.5) + a "Delivery Module Activated" addendum; `Addendum` on docs 19–21 and `Implementation Status Note 45` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
44. `… — Customer Storefront Wording: Services Catalog / Add to Invoice / Invoice` (Update 69; Update 44 in `morise.docx`) — an administrator's storefront rename: **"Product Catalog" → "Services Catalog"**, **"Add to Cart" → "Add to Invoice"** (and "Added to Cart ✓" / "Add to cart — {branch}"), **"Cart" → "Invoice"** (header link, `Shop / Cart` breadcrumb, `Cart & Checkout` heading, empty-state and split/discount copy). Applied to `mbms/storefront/src/locales/en.js` in full plus the matching already-translated keys in `eu.js` (fr/es/pt/de/it) and `regional.js` (sw/lg/ar full; nyn/ach partial); header basket icon 🛒 → 🧾. **Front-end strings only** — `t()` keys, the `/cart` route, the `Cart*` components, CSS and the `orders`/`invoices` back end unchanged; an order still creates its `Invoice` at order time as before. `vite build` clean (73 modules). Addendum on docs 19–21 and `Implementation Status Note 46` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
45. `… — Payroll Management — Feature Specification` (Update 70; Update 45 in `morise.docx`) — an administrator's request to record a **multi-subsidiary Payroll Management** section: salary structures (basic, allowances, overtime, bonuses, commissions), deductions (loans, advances, taxes, statutory, pension), payroll approval, payslip generation, bank payment schedules, payroll history, and **department / company / consolidated group payroll reports**. **Core already built** (Update 41): monthly `PayrollRun` per subsidiary (draft → approved → paid), `Payslip` per employee with Uganda PAYE + NSSF, `SalaryAdvance` with auto-recovery, GL posting on pay, `payroll.viewAll` group visibility, `My Payslips` self-service. **Backlog** (recorded, not built): the salary-structure component model, typed deductions, a long-term loan facility, a voluntary pension, a payslip PDF, bank payment schedules / EFT, and the reporting suite (no report endpoint / no department dimension today). **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 47` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
46. `… — Payroll: Salary Structures, Allowances, Overtime & Bonuses` (Update 71; Update 46 in `morise.docx`) — **implements** the first slice of the Update 70 payroll backlog. An employee's pay is now built from a **`salary_components`** structure (`type` basic / allowance / overtime / bonus, label, amount, `recurring` flag, `period_year` / `period_month` for a one-off line); a **`payslip_components`** child table records the earnings breakdown per payslip (migration `20260901120000_salary_structures`). `PayrollService.createRun` derives gross from the sum of the applicable components (recurring + one-off items for that month), falling back to `Employee.grossSalary` when there's no structure; **PAYE / NSSF and the GL posting are unchanged**. New `GET`/`POST`/`PATCH`/`DELETE /api/v1/payroll/salary-components` + `GET /api/v1/payroll/salary-structure/:employeeId` (assembled structure + PAYE/NSSF/net preview) under the **existing** `payroll.manage` / `payroll.viewAll`. Admin Payroll screen gains a **Salary structures** tab; each payslip row expands to its components; `My Payslips` carries the breakdown. Seeded structures for Grace Auma & Peter Kintu; verified end to end (`nest build` + admin `vite build` clean). Still backlog: commissions, typed deductions, loans, voluntary pension, payslip PDF, bank schedules, reporting suite. Addendum on docs 19–21 and `Implementation Status Note 48` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
47. `… — Accounting & Finance Feature Section` (Update 72; Update 47 in `morise.docx`) — an administrator's request to record a **"7. Accounting and Finance"** section (General Ledger, Accounts Receivable, Accounts Payable, Financial Statements) as a core component. **Already the deepest built area of MBMS** (Sprint 10 *Full Accounting* + the 19 Aug 2026 *Financial Module Deepening*): chart of accounts, journals (draft → posted; `standard`/`adjusting`/`closing` types), financial periods (open → closed, closing entries posted), account reconciliation, recurring journals; AR credit/debit notes, payments, aging, outstanding invoices, statements + reminders; the AP supplier-invoice approval workflow (`ap.approve`), payments, notes, statements, aging, payment schedules; and the nine financial statements at `/accounting/reports/`. **Gap:** a dedicated AR sub-ledger reconciliation (`purchase invoices` = `supplier invoices`, one entity). **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 49` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
48. `… — Cash & Bank Management Feature Section` (Update 73; Update 48 in `morise.docx`) — an administrator's request to record a **"Cash and Bank Management"** section (12 features). **No dedicated Cash & Bank module yet.** Built: **bank / cash reconciliation** (`AccountReconciliation` + `/accounting/reconciliations`) and the group **cash-position figures** (dashboard `bankBalances`, `/finance/overview`). Reachable via the GL: bank / cash accounts (GL `Account`, `accountSubType` bank / cash) and deposits / withdrawals / transfers (manual journal entries). **Backlog:** a purpose-built bank / cash account register, petty cash, one-step deposit / withdraw / transfer actions, payment / receipt vouchers, cash-flow forecasting, and a dedicated cash-position report. **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 50` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
49. `… — Budget Management Feature Section` (Update 74; Update 49 in `morise.docx`) — an administrator's request to record a **"Budget Management"** section (13 features). **Partly built.** Built: **company budgets** (`Budget` = one amount per GL account per financial period; `/accounting/budgets`, every change audited), **project budgets** (`Project.budget` + project variance), **budget versus actual** (`/accounting/reports/budget-vs-actual` — budgeted / actual / variance / %; also in `management-accounts`). **Partial:** utilization (derived %), revisions (audit trail, not versioned), variance analysis (the number only), annual / capex / opex (a `Budget` line on the relevant period/account). **Backlog:** a **department** dimension, **group** roll-up, **budget approval** workflow, versioned **revisions**, a dedicated **utilization** report, **budget alerts**. **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 51` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
50. `… — Sales Management Feature Section` (Update 75; Update 50 in `morise.docx`) — an administrator's request to record a **"Sales Management"** section (Customer Management, Sales, CRM). **Built:** the `Customer` record (name, category, contact, `credit_limit`, `payment_terms_days`, status), staff + storefront registration, `PATCH` edits, per-customer statement + order/invoice/payment history; the `Order` fulfilment status machine (`/sales/orders`), an `Invoice` per order, `CustomerCreditNote`, admin-managed discount codes + promo banners, the Delivery module; `SupportTicket` as the complaint/feedback/interaction channel. **Partial:** multi-contact (single email/phone), credit-limit (stored, not enforced), delivery-note/receipt documents. **Backlog:** quotations, sales-return/RMA, printable delivery notes + receipts, sales commissions/targets/performance (deferred), and the **whole CRM** (leads → opportunities → pipeline, an activity log for calls/emails/meetings, follow-ups, structured feedback). **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 52` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
51. `… — Procurement & Purchasing Feature Section` (Update 76; Update 51 in `morise.docx`) — an administrator's request to record a **"Procurement and Purchasing"** section (11 features + the workflow *Request → Department Approval → Procurement → Quotations → Evaluation → Management Approval → PO → Delivery → Inspection → Invoice → Payment*). **No dedicated Procurement module** (deferred Phase-2). **Built:** the supplier master (`Supplier`, `/suppliers`, blacklist) and the Accounts Payable tail — `SupplierInvoice` `draft → pending_approval → approved → paid` (`/ap/invoices/:id/submit-for-approval` + `/approve`, `ap.approve`, GL posted on approve), supplier payments, credit notes, AP aging, statement, payment schedule. **Partial:** purchase approvals (AP invoice approval only), purchase returns (a supplier credit note), procurement budgets (a `Budget` line), procurement reports (AP reports). **Backlog:** purchase requisitions, purchase orders, RFQs, supplier quotations + comparison, evaluation/award, PO approval chain, goods received notes + inspection (no inbound-goods/inventory model), a distinct purchase-return flow, a three-way match, and procurement reporting — the request-to-PO front of the process (`05_Business Process Document` §6.5 describes it). **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 53` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
52. `… — Supplier Management Feature Section` (Update 77; Update 52 in `morise.docx`) — an administrator's request to record a **"Supplier Management"** section (13 features). **Supplier master built.** Built: `Supplier` registration / profiles / categories (`/suppliers`, `supplier.manage`, audited), tax id + bank details (`bank_account_number` masked unless `supplier.view.sensitive`), payment history + statements (`GET /api/v1/ap/statement`), blacklist / un-blacklist (`SupplierStatus` active/inactive/blacklisted). **Partial:** suspension (blacklist + `inactive` only), contacts (single email/phone), contracts + documents (a text `contract_reference` + expiry; no uploaded/versioned files — object-storage gap). **Backlog:** a multi-contact list, contract/document files, a time-bound suspension, and supplier **evaluation / performance** scoring. **Documentation only** — no code/schema/endpoint/permission/migration change. Addendum on docs 19–21 and `Implementation Status Note 54` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.
53. `… — Supplier Management: Contacts, Suspension & Evaluation` (Update 78; Update 53 in `morise.docx`) — **implements** the Update 77 supplier backlog. Migration `20260901130000_supplier_management`: **`supplier_contacts`** (name, title, email, phone, `is_primary` — one primary enforced by the service — note); **`supplier_evaluations`** (period label, five `1–5` criteria: delivery / quality / price / communication / compliance; `overall_score` = their average; comments; evaluator); `SupplierStatus` gains **`suspended`**; `suppliers` gains `suspension_reason` + `suspended_until`. New endpoints under the **existing** `supplier.manage` / `supplier.viewAll` (no new permission): `GET`/`POST /suppliers/:id/contacts` + `PATCH`/`DELETE …/contacts/:contactId`; `POST /suppliers/:id/suspend` (reason + optional auto-lift date) + `/unsuspend` (**409** on a blacklisted supplier; a past-dated suspension **auto-lifts on read**); `GET`/`POST /suppliers/:id/evaluations` + `DELETE …/evaluations/:evaluationId`; and `GET /suppliers/:id/performance` — a **derived** summary (evaluation count, overall average, rating band Excellent / Good / Fair / Poor, trend vs the previous scorecard, per-criterion averages, and the supplier's AP position), **no backing table**. Every mutation audited (`supplier.contact.*`, `supplier.evaluation.*`, `supplier.record.updated`); bank / tax kept out of payloads; routes company-scoped like `GET /suppliers/:id`. Admin `Suppliers.jsx` gains a supplier **detail dialog** (Contacts / Evaluations / Performance tabs, Suspend control). Seed: three contacts + two quarterly scorecards for **AgroChem Uganda Ltd**. Still backlog: supplier **contracts / documents** as uploaded versioned files (object-storage gap). Verified end to end; `nest build` + admin `vite build` clean. Addendum on docs 19–21 and `Implementation Status Note 55` in `Multi_Holdings_Limited_Software_Development_Procedures.docx`.

Two independent "Sprint N" numbering schemes exist in this set — see
`mbms/README.md` ("Sprint 10" section) and project memory before treating a
`Sprint N` request as a mismatch.

| # | Document | Nav redesign | Delegated administration | Permission-based visibility |
|---|----------|--------------|--------------------------|----------------------------|
| 01 | Project Proposal | Admin IA → 4 categories | Delegated grant authority | Users see only granted operations |
| 02 | Project Charter / Business Case | Deliverables note | Who may delegate access | Least-privilege UI benefit |
| 03 | Feasibility Study | No feasibility impact | Manager-led access admin | No feasibility impact |
| 04 | Software Requirements Specification | Nav taxonomy + planned modules | Grantor authority, domain, scope | New FR: hide/deny unpermitted routes |
| 05 | Business Process Document | Menu-to-process mapping | Grant/Revoke Access process | Process actors see only their steps |
| 06 | User Stories, Epics & Product Backlog | Stories for 14 planned screens | MD / Branch / HR delegation stories | "I don't see what I can't do" story |
| 07 | System Design Document | Routing/nav change | DelegationService, domain, guard | permissions in token payload; capabilities map + RequireAuth guard |
| 08 | Database Design Document | No schema change | `permissions.domain` column | No schema change |
| 09 | API Specification | No new endpoints | `identity.user.delegate`, delegatable-grants | `permissions[]` added to login/refresh/me |
| 10 | Test Plan | Nav regression checklist | Delegation authority matrix | Per-role nav visibility + URL-guard tests |
| 11 | Deployment Plan | Front-end-only release | One migration + reseed | Front-end + payload change, no migration |
| 12 | UAT Plan | Nav-taxonomy scenario | Managers grant within bounds | Each role sees only its own menu |
| 13 | Alpha Test Plan | Exploratory nav pass | Delegation access-control check | Visibility spot-check per persona |
| 14 | User Manual | "Finding your way around" | "What you can do depends on grants" | "You only see what you can use" |
| 15 | Administrator Manual | New menu map | Delegation model + responsibilities | Menu differs per user; capabilities map |
| 16 | Maintenance Plan | Planned screens tracked | Keep DELEGATION_RULES current | Keep ROUTE_CAPABILITIES current per screen |
| 17 | Development Plan | Planned screens sequenced | Delegation engine delivered | Nav/route gating delivered; per-module verb sweep still deferred |
| 18 | UI-UX Design | Nav Structure → 4 categories | Users & Settings: filtered grants | Sidebar renders per-permission; empty categories hidden |

**Update 29 — Customer Storefront Localisation** per document: **04 SRS** new FR
(language selection + English fallback); **07 System Design** i18n context +
locale catalogue, no service change; **08 DB Design** no schema change
(preference is client-side); **09 API Spec** no API change; **10 Test Plan**
language-switch + fallback cases; **14 User Manual** how a customer changes
language; **18 UI-UX** language picker in header / Landing / Login, family
grouping; the rest carry a short scope/impact note.

**Update 30 — Storefront Localisation Extended to World Languages** per
document: the language set grows from Uganda's languages to **43** (adding the
major languages of Africa, Asia, Europe, the Americas and Oceania), eight now
carry the key-UI translations (adds French, Spanish, Portuguese, German,
Italian, Arabic), and **Arabic introduces right-to-left** (`<html dir>` flip
+ `[dir=rtl]` CSS). Still front-end only — no API, schema or migration
change. **04 SRS / 10 Test Plan / 18 UI-UX** carry the RTL and expanded-set
detail; the rest carry a short note.

**Update 31 — Full Storefront Localisation (Every Screen)** per document: every
visible storefront string is now a catalogue key (~190), split into
`locales/en.js` + `eu.js` + `regional.js`; the eight non-English fully
translated languages now cover the whole storefront — all eleven pages, the
Landing page and disclaimer, every form label / placeholder / empty state /
table header / error, and the status & priority badges (`tStatus` /
`tPriority` helpers). Still front-end only. **04 SRS / 07 System Design / 10
Test Plan / 14 User Manual / 18 UI-UX** carry the detail; the rest carry a
short note.

**Update 32 — Database Content Localisation** per document: database text
(product/category names, units, and glossary-reachable description/ticket
text) is returned in the customer's language via a curated bidirectional
**glossary + `TranslationProvider` seam** (offline default = no-op); customer
input (support tickets, ticket replies, delivery addresses) is **stored in
English**, with `source_language` + `*_original` companion columns preserving
the exact wording (one Prisma migration). **04 SRS / 07 System Design / 08
Database Design / 09 API Specification / 10 Test Plan / 15 Administrator
Manual** carry the detail; the rest a short note.

**Update 33 — Currency & Figure Localisation** per document: monetary amounts
(API returns UGX) are **converted and re-formatted** for the chosen
language's locale — currency, value, separators and digit script — while
storage stays canonical UGX; numerals a customer types in another script are
**normalised to 0-9** on write. Fixed demo FX rates; client-side display
formatting (`storefront/src/lib/format.js`) plus backend digit
transliteration. **04 SRS / 07 System Design / 08 Database Design / 09 API
Specification / 10 Test Plan / 15 Administrator Manual** carry the detail; the
rest a short note.

**Update 34 — Subsidiary Lifecycle & Clearing / Forwarding Subsidiary** per
document: the Managing Director gains full view/create/update/delete/activate
over subsidiaries and their branches, departments, policies and users (new
`DELETE` + `activate`/`deactivate` endpoints, referential delete-guards,
`Managing Director` role gets `organization.company.manage` +
`identity.user.manage`); **Morise Clearing & Forwarding Ltd** is seeded as a
wholly-owned subsidiary with 6 branches, 8 departments and 4 policies; its
16-module clearing/forwarding/logistics system is specified in the **new doc
19** with a five-phase backlog (not built). **02 / 04 / 06 / 07 / 09 / 10 / 15
/ 17 / 18** carry the detail; the rest a short note.

**Update 35 — Warehouse Management Subsidiary** per document: using the same
subsidiary-lifecycle capability, the Managing Director sets up a second
wholly-owned subsidiary, **Morise Warehouse Management Ltd**, with 5 warehouse
branches (Kampala Central, Jinja, Mbarara, Gulu, Mbale), 9 departments and 5
starter policies. Its 12-module Warehouse Management System is specified in the
**new doc 20** with a five-phase backlog (not built; reuses the existing
platform where possible). Only `seed.ts` changes — no code, schema or
permission change (MD CRUD was delivered in Update 34). **01–18 / morise**
each carry a note; **15 / 17 / morise** carry the detail.

**Update 36 — Inventory Section Activated** per document: the Admin
**Inventory** screen (ADMIN / BACKEND) goes from a *Coming Soon* placeholder
to working — company-level stock on hand, a new `products.reorder_point`
column, receipt / issue / count adjustments with an over-issue **409** guard,
and a new immutable `stock_movements` ledger (`StockMovementType` enum). New
backend module `src/inventory`, migration
`20260828120000_inventory_stock_movements`, new page `Inventory.jsx`. Reads
scoped per BR-01; writes need `product.manage`; all audited. Per-branch stock
stays WMS scope (doc 20, Module 2). **04 / 05 / 07 / 08 / 09 / 10 / 15 / 17 /
morise** carry the detail; the rest a short note. (`morise.docx` numbers this
Update 11.)

---

## Status summary

- **Backend:** all Phase 1 modules + several Phase 2 modules built and running (see `mbms/README.md`). Identity Service enforces a **delegated-administration model** on all role/permission grants; login/refresh/`me` carry effective permission codes. Customer-portal endpoints translate database text to the customer's language on read, and normalise the customer's input — words **and numerals** — to English on write. The **Organization Service now supports the full subsidiary lifecycle** (create/update/**delete**/activate/deactivate for companies, branches, departments, policies) and the **Managing Director** holds the **complete permission catalogue** — full view/create/edit/approve/execute authority across every section of ADMIN / BACKEND, HUMAN RESOURCES, MY HR and FINANCIAL & ACCOUNTING (and 16 admin screens now gate their in-page controls on the permission, not a role list). The API is **self-documenting** — a generated OpenAPI 3 contract with Swagger UI at `/api/v1/docs` and the raw document at `/api/v1/docs-json`.
- **Admin app:** all previously working screens intact, under 4 collapsible categories; **Users & Settings** only offers grants the signed-in admin is authorised to make; the **sidebar and routes are permission-filtered**. **Companies & Company detail** gain Activate/Deactivate/Delete controls for subsidiaries and their branches / departments / policies (MD / Super Admin / IT Admin). The **Inventory** screen is now live — company-level stock on hand, re-order points, receipt / issue / count adjustments and an immutable movement ledger (view with `product.viewAll`, adjust with `product.manage`). **Marketing & Promos** (discount codes + promo banners) and **CMS / Site Builder** (draft/publish content pages, the group's **social media channels**, the **landing-page FAQ**, and the **newsletter sign-ups** list) are also live, gated by `marketing.*` / `cms.*` permissions — held in full (`manage` + `viewAll`) by the **Managing Director**, Super Administrator and IT Administrator. The **HR Dashboard** (read-only headcount / attendance / recruitment / upcoming-events roll-up) and **Departments** (list-across-companies with headcount, create / rename / delete) screens are live under Human Resources. **Shift Scheduling** (weekly roster builder, publish + notify, coverage & clash view — reuses `attendance.*`) and **Payroll** (monthly run with Uganda PAYE/NSSF, payslips, salary advances, balanced GL posting — new `payroll.*` permissions with a preparer/approver split) complete that section. The **MY HR** self-service set — Clock In/Out, My Leave, My Shifts, My Performance, My Payslips, My Salary Advances — is live for any login **linked to an employee record** (`src/my-hr/`, read projection + a self-service salary-advance request; no new permission). The **Financial & Accounting** overview (`/finance`) is a read-only landing screen — consolidated group position, working-capital "needs attention" figures, period-close status, and shortcut cards into the sub-screens (`src/finance/`; any finance-area permission; no new permission). **Every entry in all four navigation categories now opens a working screen.**
- **Storefront:** the **public entry is a holding-company mini-site** — a signed-out visitor gets a corporate site (landing with live group figures, Companies directory + per-company pages, Profile, Group Leadership, Group Overview, News, Contacts), all readable without an account and fed by a new public `GET /customer-portal/public/overview`; a signed-in customer still lands on their dashboard. These pages use the **same design system as the shop** (navy/white/amber, system fonts) so the public site and the storefront look like one product. Beyond that, customers **register / sign in with email, phone, account number or Google and reset a forgotten password** themselves. The shop is a **group storefront** — the priced goods **and services of all five Morise subsidiaries** (Agro inputs & fuel; Logistics road freight & delivery; Clearing & Forwarding customs & freight-forwarding; Warehouse Management storage & handling; Collateral Management CMA setup, field-warehousing control, inspection, valuation & coverage monitoring, release authorisation, warehouse-receipt issuance) in one catalogue of 34 items, each listing **tagged with its subsidiary and fulfilling branch**, filterable by company or branch, with a **Subsidiaries directory** page; the customer's own **subsidiary and branch** are shown in the header and on My Account. A basket spanning subsidiaries is **placed as one order per subsidiary** (each invoiced and GL-posted in that company's books). Customers can also **switch the whole interface into 43 languages** (English + 8 translated in full; Arabic right-to-left) — including the **pre-login disclaimer gate and the corporate landing pages** (first visit picks the language from `?lang=` or the browser); **catalogue, support text, promo banners, CMS content pages, the FAQ, the disclaimer statements, order history, the Home dashboard, the account statement and the downloaded statement / invoice PDFs are shown in the chosen language**, **monetary amounts are converted and formatted for that locale** (UGX → AED / EUR / BRL, fixed demo rates), and figures/digits follow the language's script (a non-Latin-script PDF keeps its label words in English pending font embedding). Customer input — including an order cancellation note, a payment reference and a typed discount code — is stored / matched canonically (English, UGX, 0-9) with the original kept. Customers can **apply a discount code at checkout** (validated + redeemed server-side, single-subsidiary carts; discount taken before VAT; the outcome message is localised), see **promo banners** on the home page, and read **published content pages** at `/page/:slug` (About / Terms / Delivery). The **storefront footer** (public and signed-in) shows the **group's social media channels**, managed by an admin in CMS / Site Builder and served by the public `GET /customer-portal/public/social-links`. The **landing page** carries a **newsletter sign-up band** (`POST /customer-portal/public/newsletter`, rate-limited) and an **FAQ section** whose Q&A an admin manages in CMS / Site Builder (`GET /customer-portal/public/faqs`).
- **Subsidiaries:** Morise Agro Ltd, **Morise Logistics Ltd** (Jinja Branch; four priced storefront services incl. last-mile delivery `LOG-2003`; its **Delivery Management System** specified in doc 22 — Phase 1 back end built in MBMS and **activated** (`delivery.manage` / `delivery.viewAll` seeded + granted, 31 Aug 2026); a dispatcher can create a delivery for a customer's order and assign a Morise Logistics Ltd delivery persona through `/api/v1/delivery` (verified); an Admin dispatch screen and seeded personas are still to build. doc 22 addenda also add an automatic Morise-stamped invoice on customer-acknowledged delivery, spec only), **Morise Clearing & Forwarding Ltd** (6 branches, 8 departments, 4 policies; its system specified in doc 19, not built), **Morise Warehouse Management Ltd** (5 branches, 9 departments, 5 policies; its 12-module WMS specified in doc 20, not built), and **Morise Collateral Management Ltd** (new — collateral management agent; 6 sites, 9 departments, 6 policies; **10 priced services** in the storefront (CMC-5001–CMC-5010) drawn from the client's services catalogue; its 10-module Multi-Site Collateral Management System specified in doc 21, not built). Group: **5 subsidiaries, 20 sites / branches, 34 catalogue items**.
- **Docs:** **22 numbered documents** + `morise.docx`; docs 01–18 and `morise.docx` carry the fifty-three 27 August – 1 September 2026 status updates (navigation redesign; delegated administration; permission-based visibility; storefront localisation ×3; database content localisation; currency & figure localisation; subsidiary lifecycle; warehouse-management subsidiary; inventory section activated; marketing & promos and CMS / site builder activated; MD full control of marketing & CMS; localisation extended to promo banners & CMS content; HR Dashboard & Departments activated; Shift Scheduling & Payroll activated; My HR self-service activated; demo staff logins linked to employee records; Financial & Accounting overview activated; customer sign-up, multi-identifier login & password reset; one storefront across every subsidiary and its branches; Clearing / Forwarding & Warehouse-Management catalogues added to the storefront; content localisation extended to the group storefront (read in chosen language, store input in English); OpenAPI / Swagger API documentation generated from the backend; corporate landing page & public holding-company mini-site; corporate site restyled to match the shop page; public content pages folded into the corporate site chrome; admin-managed social media channels shown in the storefront footer; landing-page newsletter sign-up + admin-managed FAQ section; content localisation completed across orders & payments; content localisation final edges — dashboard, account statement & exported PDFs, discount-code input; Collateral Management subsidiary + new doc 21; full-page demonstration-disclaimer gate with admin-managed statements; disclaimer gate & corporate landing pages localised into the chosen language; Collateral Management priced services catalogue added to the storefront; Managing Director full operational authority across every admin category; Morise brand mark / professional logo across both apps; Morise banner family across both apps; brand banners displayed across the customer storefront; Delivery Management System specification for Morise Logistics Ltd (new doc 22); automatic Morise-stamped invoice on customer-acknowledged delivery (doc 22 addendum); admin assignment of a Morise Logistics Ltd delivery persona to an order (doc 22 addendum); delivery module activated — `delivery.manage` / `delivery.viewAll` seeded + granted; Customer Storefront wording — Services Catalog / Add to Invoice / Invoice; Payroll Management feature specification (core built Update 41; structure / bank-schedule / reporting suite recorded as backlog); Payroll: salary structures, allowances, overtime & bonuses built (Update 71); Accounting & Finance feature section recorded (Update 72 — already built; one gap: dedicated AR reconciliation); Cash & Bank Management feature section recorded (Update 73 — reconciliation + cash position built; register / petty cash / vouchers / transfers / forecasting on the backlog); Budget Management feature section recorded (Update 74 — company / project budgets + budget-vs-actual built; dimensions / approval / revisions / utilization / alerts on the backlog); Sales Management feature section recorded (Update 75 — customer management + order-to-cash core built; quotations / returns / commissions / targets and the whole CRM on the backlog); Procurement & Purchasing feature section recorded (Update 76 — supplier master + AP invoice tail built; requisitions / POs / RFQs / quotations / GRNs on the backlog); Supplier Management feature section recorded (Update 77 — supplier master built; multi-contact / contract & document files / suspension / evaluation & performance on the backlog); **Supplier Management implemented (Update 78 — multi-contact list, time-bound suspension, evaluation scorecards & a derived performance summary built; contract / document files still on the backlog)**). Docs 19–22 carry one-line addenda for the API-docs, public-site, restyle, content-page, social-channels, FAQ/newsletter, orders-localisation, final-edges, collateral-subsidiary, disclaimer-gate, pre-login-localisation, collateral-services, MD-authority, brand-mark, banner-family, banners-on-storefront, delivery, stamped-invoice, persona-assignment, delivery-activation, storefront-wording, payroll-spec, payroll-salary-structures, accounting-finance, cash-bank, budget-mgmt, sales-mgmt, procurement, supplier-mgmt and supplier-mgmt-impl passes; **doc 21** (*Multi-Site Collateral Management System — Feature Specification*) carries a full "Services Catalogue" addendum, **doc 22** (*Delivery Management System — Feature Specification*, owning entity Morise Logistics Ltd — its Phase 1 back end is coded in MBMS and **activated** as of 31 Aug 2026, permissions seeded + granted) is new and carries "Customer Acknowledgement & Stamped Invoice", "Assigning a Delivery Persona" and "Delivery Module Activated" addenda; `Multi_Holdings_Limited_Software_Development_Procedures.docx` gains `Implementation Status Note` 26–55.
