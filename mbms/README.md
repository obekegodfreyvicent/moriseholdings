# Morise Holdings Limited — Business Management System (MBMS)

Phase 1 proof-of-concept — **every module `04_Software Requirements
Specification`, Section 2.2 scopes into Phase 1 is now built**,
including the System Audit Trail: Authentication, Users/Roles/Permissions,
Company/Branch/Department management, Employee/Customer/Supplier/Product
records, basic Accounting (chart of accounts, financial periods, journal
entries, trial balance), group/subsidiary Dashboards, and a read-only Audit
Trail capturing create/update/approve/access-denied events across every
other module. This started as the "build the core system first" foundation
called for by `Multi_Holdings_Limited_Software_Development_Procedures.docx`
(Section 11, Phase 9) and grew, epic by epic, through all ten epics in
`06_User Stories` (EPIC-01 through EPIC-10).

This is real, running code — not a mockup. It implements the endpoints in
`09_API Specification`, the schema in `08_Database Design Document`, and the
screens from the Administrator mockups already published to `screenshots/`.

## What's built vs. what's deferred

**Built:**
- Identity Service: login/logout/refresh, admin-initiated password reset,
  **self-service password change** (`POST /identity/users/me/change-password`,
  added 19 August 2026), user CRUD, activate/deactivate/lock/unlock, role &
  scope assignment (company/branch/department, FR-USER-04), direct
  permission grant/revoke on top of role permissions (FR-USER-06), a
  configurable password policy (minimum length + complexity, FR-AUTH-04),
  `/users/me`. **All 23 catalogue roles are now permissioned** (RBAC
  Completion pass, 19 August 2026) — see below; previously 14 of them
  existed but granted nothing
- Organization Service: companies (with parent/subsidiary hierarchy,
  subsidiary-vs-associate relationship type and ownership %, FR-COMP-03/05),
  branches, departments, company-specific policies, all scope-restricted
  per BR-01, all auditable (create/update). Inter-company transactions
  (Company/Holdings pass): loan/transfer/service-charge/cost-allocation/
  other, each posting two independently-balanced journal entries (one per
  company) once posted
- Employee Service: employee records (identification, job title + job
  description, qualifications/skills/certifications, contract type, next of
  kin/emergency contact, company/branch/department, bank/tax fields masked
  per FR-USER-08 unless the caller holds `employee.view.sensitive`), scoped
  per BR-01, with a separate `employee.viewAll` permission for group-level
  read access. **HR Module deepening (19 August 2026)** added a real
  employment-history table (`GET /employees/{id}/employment-history`), a
  document-reference field, and an optional link to an Identity Service
  User (enabling self-service HR features), plus four entirely new
  modules built on top: **Recruitment** (vacancy → application →
  interview → offer → onboarding, closing back into a real Employee
  record), **Attendance** (self-service clock-in/out against an assigned
  shift, with late/overtime computed automatically), **Leave** (five leave
  types, balance-checked single-step approval), and **Performance**
  (review cycles, objectives/KPIs, self- and manager-assessment) — see
  "HR Module Deepening" below for the full detail
- Customer Service: customer records (profile, category, contact email/
  phone, address), credit limit/payment terms (FR-CUST-02), and a statement
  endpoint (FR-CUST-03) that honestly returns empty — no Sales/Invoicing
  service exists yet in this slice to generate transactions
- Supplier Service: supplier records (profile, category, contact, contract
  reference + expiry per FR-SUPP-02), blacklist/unblacklist (FR-SUPP-03),
  bank details masked the same way employee bank/tax fields are, behind a
  separate `supplier.view.sensitive` permission
- Product Service: products/services (`productType`, FR-PROD-01) with
  category (self-referencing hierarchy per the schema, though only flat
  categories are seeded), unit of measure (FR-PROD-03) and barcode
  (FR-PROD-02) fields, unique product codes per company (`409 CONFLICT` on
  a duplicate, verified). Warehouses/stock locations are explicitly out of
  Phase 1 scope per `04_SRS`, Section 4.8's own text — not built here
- Accounting Service: chart of accounts, financial periods (open/close),
  journal entries with BR-03 balance validation and BR-04 period-closed
  enforcement (`UNBALANCED_ENTRY` / `PERIOD_CLOSED`, matching
  `09_API Specification`'s sample responses exactly), a trial balance report
  built from posted entries only, and a general ledger report per account
  (FR-ACC-03) with a running balance, distinct from the trial balance's
  account-level aggregates. **Sprint 10** added recurring/adjusting journal
  entry templates (FR-ACC-07), Income Statement and Balance Sheet reports
  (Phase 3 pulled forward, same as Expenses was for Phase 2), and a
  `?consolidated=true` group-rollup variant of both across a holding
  company's subsidiaries. **Financial Module deepening (19 August 2026)**
  added closing entries (a real journal entry zeroing revenue/expense into
  Retained Earnings on period close), adjusting-entry tagging, account
  reconciliation, budgets, and four new statements — Cash Flow Statement,
  Statement of Changes in Equity, Financial Ratios, and a Management
  Accounts bundle — see "Financial Module Deepening" below
- Accounts Payable (new, 19 August 2026): supplier invoices with a
  draft → pending_approval → approved → paid workflow, payments (partial
  and multi-invoice), credit notes, aging, statements and a payment
  schedule
- Accounts Receivable (deepened, 19 August 2026): credit/debit notes,
  staff-facing aging and statements, and payment reminders — built on top
  of the real Invoice/Payment/Order system another concurrent session
  added (see "Financial Module Deepening" below for the duplication this
  pass found and corrected before it shipped)
- Dashboard (FR-DASH-01–05): group-level summary (companies/branches/
  employees/customers/suppliers/users) plus a live recent-activity feed
  (FR-DASH-04) for Group-level roles, and a subsidiary-scoped dashboard (per
  FR-DASH-03) with the same breakdown plus a chart-of-accounts/trial-balance
  summary (FR-DASH-02) for anyone holding an accounting permission for that
  company, not just Group-level roles. **Deepened 19 August 2026** (see
  "Dashboard Deepening" below) with group- and subsidiary-level financial
  position (total assets/revenue/expenses/net profit, cash position, bank
  balances, outstanding receivables/payables), outstanding inter-company
  loans, pending approvals, employee statistics, a company performance
  comparison, four monthly charts (revenue/expense/profit-and-loss/
  cash-flow), and financial/operational alerts — with Inventory Value,
  Sales Performance and Procurement Performance honestly reported as not
  available, since no such module exists in this codebase
- Audit Trail (FR-AUDIT-01–03): every service calls a shared `AuditService`
  directly and synchronously on its key mutations (see the architecture
  note below for why — no Kafka in this slice), and `PermissionsGuard`
  itself records `access_denied` events centrally for every FORBIDDEN
  response, across every module, with no per-controller wiring needed. A
  read-only `GET /audit/logs` (filterable by user/date/company/entity/
  action) is the only endpoint — no update or delete route exists anywhere,
  by design, per FR-AUDIT-03
- Role-based + scope-based authorization enforced server-side (not just
  hidden UI), exactly as `Multi_Holdings_Limited_Software_Development_Procedures.docx`,
  Section 16 insists on
- A connected React frontend implementing Login, Dashboard (with a live
  Recent Activity widget), Companies (list + hierarchy + Policies section),
  Employees, Customers (list + statement detail panel), Suppliers (list +
  blacklist toggle), Products (list + inline category creation), Accounting
  (now eight tabs: Chart of Accounts, Journal Entries, Financial Periods,
  Trial Balance, General Ledger, Income Statement, Balance Sheet, Recurring
  Entries), Expenses (list + submit/approve/reject/pay actions), Assets
  (list + transfer — including cross-company — /depreciation/disposal/
  maintenance actions), Projects (list + team/task/milestone management,
  status lifecycle, profitability), Inter-Company (list + create + post
  transactions across two companies), Reports (now with a subsidiary
  comparison/consolidated group report), Users & Roles, My Profile, and
  Audit Trail (filterable, expandable before/after detail per row)
- Expense Service (Phase 2, Sprint 9): expense claim submission, category
  and receipt reference (a text reference, not a file upload), a two-step
  manager/finance approval workflow, rejection with reason, and payment that
  posts a balanced journal entry to the company's ledger — the first Phase 2
  module built, on top of the Accounting Service above
- Asset Service (Phase 2, Sprint 11): asset registration with custodian/
  location, straight-line depreciation posting to the ledger, a three-step
  disposal workflow (request → management approval/inspection → execute)
  posting a full derecognition entry, and maintenance logging — the second
  Phase 2 module built. Cross-company transfer added in the Company/
  Holdings pass (both source and destination company scope required, GL
  account links cleared on a cross-company move)
- Project Service (Phase 2, Sprint 12): project registration, team/task
  management, milestones, a five-step status lifecycle (planned → active
  ↔ on hold → completed → closed), and profitability review (budget vs.
  actual cost — reusing the Expense Service's `paid` claims, now
  attributable to a project — vs. revenue) — the third Phase 2 module built
- Reports Service (**Phase 1**, RPT-01–06, Sprint 13): company/branch,
  employee, customer, supplier, chart-of-accounts/trial-balance and audit
  trail reports, each exportable to CSV or a real PDF (`pdfkit`) — closing
  out `04_Software Requirements Specification`, Section 8, unbuilt since
  the document's first version. A subsidiary comparison/consolidated group
  report (headcount/customers/suppliers/assets/projects, plus revenue/
  expense per company when a financial-period name is given) was added in
  the Company/Holdings pass, reusing the same CSV/PDF export helper
- Notifications (Sprint 14): an in-app feed (`morise.docx`, Section 39 —
  "Workflow notifications" specifically; email/push/SMS channels remain
  deferred, no external delivery infrastructure exists), wired into the
  expense-approval and asset-disposal workflows as a demonstrated pattern,
  plus a Dashboard deepening covering every Phase 2 module built since
  Sprint 6 (assets/projects summaries, pending-approval counts)
- Company and Holdings Management deepening (`morise.docx`, Section 2, 19
  August 2026): company-specific policies, group-wide inter-company
  transactions (double-entry, one balanced journal entry per company),
  cross-company asset transfer, and a consolidated group/subsidiary-
  comparison report — closing out the four items from that section's
  feature list not already covered by Sprint 2 or Sprint 10

**Deliberately deferred**: Procurement and Inventory — both Phase 2+ per
`04_Software Requirements Specification`, Section 12. **Sales is no
longer on this list** — see "Sprint 16: Customer Storefront," below,
which built a real Sales/Invoicing/Payments/Support slice, along with the
first customer-facing (not staff-facing) web app in this codebase. The
Administrator mockups' remaining Phase 2+ screens (Procurement, Inventory)
still show only what that scope will eventually look like; this slice
doesn't fake working versions of those two. **Expenses** (Sprint 9),
**Assets** (Sprint 11), **Projects** (Sprint 12) and now **Sales/Customer
Storefront** (Sprint 16) are the exceptions, built ahead of Phase 2 being
formally proposed or approved.

## Sprint 1 verification pass (18 August 2026)

`17_Development Plan`, Section 6 names Sprint 1 as "Authentication, Users,
Roles and Permissions" — the first slice built, several sessions before the
rest of this document. Rather than rebuilding it, this pass re-checked the
existing Identity Service line-by-line against every requirement `04_Software
Requirements Specification`, Sections 4.1 and 4.3 name (FR-AUTH-01–06,
FR-USER-01–08) and fixed what didn't hold up:

- **FR-AUTH-04** ("configurable password policy — minimum length/
  complexity") was checked in as `@MinLength(8)` only: length was hardcoded,
  not configurable, and there was no complexity check at all. Fixed with a
  shared `IsStrongPassword` validator (`common/validators/`) reading its
  minimum from `PASSWORD_MIN_LENGTH` and requiring an uppercase letter, a
  lowercase letter and a digit — applied to both user creation and password
  reset confirm.
- **FR-USER-04** ("assignment of users to specific companies, branches
  **and departments**") only had company/branch on `UserScope` — department
  was missing entirely. Added an optional `departmentId` column (migration
  `sprint1_user_permissions_and_department_scope`) and wired it through the
  scope-assignment endpoint and the Users & Roles screen.
- **FR-USER-06** ("assignment of one or more roles, **and specific
  permissions**, to a user") only supported roles — there was no way to
  grant a single permission directly to a user without creating or editing
  a role. Added a `UserPermission` join table, `POST`/`DELETE
  /identity/users/{id}/permissions`, and merged direct grants into the
  permission set `JwtStrategy` puts on every token (additive to whatever
  the user's roles already carry — there is no direct-deny concept, matching
  how `RolePermission` has no deny concept either).

Every other FR-AUTH/FR-USER requirement (login/logout/refresh, lockout after
5 failed attempts, admin-initiated reset and lock/unlock, own-profile
self-service, the role catalogue endpoint, scope-based module/company/branch
restriction, and FR-USER-08's bank/tax field masking) was already correctly
implemented and needed no change.

All of the above — the three fixes and the requirements that already
worked — were re-verified end-to-end after the fix, not just read: a curl
matrix covering every FR-AUTH/FR-USER id (weak-password rejection at both
the create-user and password-reset-confirm endpoints, a role-less user
granted only a direct permission successfully calling the endpoint that
permission gates and being correctly refused everything else, a company/
branch/department scope round-trip, the 5-failed-attempt lockout, and
admin unlock), plus a Playwright pass confirming the new Users & Roles
screen sections (Direct Permissions, Company/Branch/Department Scope)
render and submit correctly with zero console errors.

## Sprint 2 verification pass (18 August 2026)

Same method as the Sprint 1 pass above: re-checked the existing Organization
Service (Companies, Branches, Departments) line-by-line against
`04_Software Requirements Specification`, Section 4.2 (FR-COMP-01–09), and
fixed what didn't hold up.

- **FR-COMP-03** ("registration of associated companies/affiliates") had no
  way to say whether a non-root company was a subsidiary or an associate —
  every child company was created the same way, distinguishable only by
  having a `parentCompanyId`. Added a `relationshipType` enum
  (`subsidiary`/`associate`), required on every non-root company (migration
  `sprint2_company_relationship_ownership`).
- **FR-COMP-05** ("definition of company ownership structures") had the
  parent/subsidiary link but no ownership percentage. Added an optional
  `ownershipPercent` field (0–100) on the same migration.
- **FR-COMP-06** ("store ... logo") — the schema already had a `logoUrl`
  column, but neither `CreateCompanyDto` nor `UpdateCompanyDto` exposed it,
  so it was silently unsettable through the API despite existing in the
  database. Added to both DTOs. Full "official documents" storage (the rest
  of FR-COMP-06) remains deliberately deferred — it needs real object
  storage infrastructure, the same honest gap already noted for Employee and
  Supplier document upload.
- **Demo-reachability gap, not a requirement gap**: no seeded demo user held
  `organization.company.manage` at all — the permission existed and was
  enforced correctly, but every FR-COMP create/edit action was consequently
  unreachable through the demo, and the frontend's "+ New Company" /
  "+ New Branch" / "+ New Department" buttons were separately gated by a
  hardcoded `hasRole('Super Administrator')` check — a role no seeded user
  holds either, and one that wouldn't have matched the new IT Administrator
  grant even after the permission fix. Both are corrected: IT Administrator
  now holds `organization.company.manage`, and the buttons check
  `hasRole('Super Administrator', 'IT Administrator')`.
- Branches and Departments create/update were not calling `AuditService` at
  all (Companies already was) — added, matching the Companies pattern, so
  every Organization Service mutation is now represented in the audit trail,
  not just company-level ones.

Every other FR-COMP requirement (holding company creation, subsidiary
registration, branch/office registration, currency and financial year
configuration, department configuration, and the Group-level consolidated
view) was already correctly implemented and needed no change.

Re-verified end-to-end after the fixes: a curl pass confirming a subsidiary
create without `relationshipType` is correctly rejected with
`VALIDATION_ERROR`, an associate company created with ownership % and a
logo URL round-trips correctly, branch and department creation each produce
a matching `organization.branch.created`/`organization.department.created`
audit entry, and a Playwright pass confirming the Companies screen's new
Relationship/Ownership %/Logo URL fields render (conditionally, only once a
parent company ID is entered) and submit correctly with zero console
errors.

## Sprint 3 verification pass (18 August 2026)

Same method again: re-checked the existing Employee Service against
`04_Software Requirements Specification`, Section 4.5 (FR-EMP-01–06).

- **FR-EMP-02** ("record employment history, contracts and job
  descriptions") had `contractType` and start/end dates but no
  `jobDescription` field at all. Added (migration
  `sprint3_employee_job_description_qualifications`). Full multi-position
  employment *history* (more than one past role per employee) remains out
  of scope — the current model captures one current position with a start/
  end date, a reasonable proxy for "Should"-priority Sprint 3, not a
  history table.
- **FR-EMP-03** ("record qualifications, skills and certifications") had no
  field at all — this was already flagged "Not started" in an earlier
  status update and stayed that way until this pass. Added a freeform
  `qualifications` text field on the same migration (this is a "Could"
  priority requirement; a freeform field, not a structured
  qualification-by-qualification table, matches that priority).
- **UI gap, not a schema/API gap**: the Employees screen's create form only
  ever exposed `companyId`, `employeeNumber`, `firstName`, `lastName`,
  `jobTitle` and `employmentStartDate` — every other field this service
  supports (`nationalId`, `contractType`, next of kin, emergency contact,
  bank/tax) existed in the schema and the API and was correctly masked on
  read, but had no way to be entered through the UI at all. This matches
  the same "correct code, unreachable through the UI" class of gap found in
  Sprint 2's demo-reachability issue. Fixed by expanding the create form to
  every field the API accepts, grouped into Job / Next of Kin & Emergency
  Contact / Bank & Tax sections.

FR-EMP-01 (identification, employee number, job title, department, branch,
company), FR-EMP-04 (next of kin/emergency contact — already correctly
modeled, just not reachable from the UI, fixed above) and FR-EMP-05
(bank/tax, masked) were already correctly implemented at the API level.
FR-EMP-06 (document upload) remains deliberately deferred pending real
object storage infrastructure, the same honest gap already noted for
Company logos and Supplier documents.

Re-verified end-to-end: a curl create with every field populated
round-trips correctly including the two new fields; masking was re-checked
specifically with the Managing Director account (`employee.viewAll` but not
`employee.view.sensitive`) to confirm bank/tax fields still read as
`•••• restricted ••••` with the expanded field set; and a Playwright pass
confirmed the expanded create form renders all four sections and scrolls
correctly with zero console errors.

## Sprint 4 verification pass (18 August 2026)

Same method again: re-checked Customer and Supplier Records against
`04_Software Requirements Specification`, Sections 4.6 (FR-CUST-01–03) and
4.7 (FR-SUPP-01–03).

- **FR-SUPP-02** ("record supplier contracts, documents, tax information and
  bank details") had tax ID and bank details but nothing for contracts at
  all. Added `contractReference` and `contractExpiryDate` fields (migration
  `sprint4_supplier_contract_reference`) — a reference/number and expiry
  date, not a document. Full contract document storage remains deliberately
  deferred pending real object storage infrastructure, the same honest gap
  already noted for Company logos and Employee documents.
- **Audit gap**: `suppliers.service.ts`'s `update()` never called
  `AuditService` — only `create()`, `blacklist()` and `unblacklist()` did.
  Fixed, following the same bank/tax-exclusion convention Employees already
  established (sensitive field values never carried in audit event
  payloads, matching `09_API Specification`, Section 11).
- **UI gap, same class as Sprint 3's**: the Suppliers create form only
  exposed `companyId`, `name`, `category` and `taxId` — contact email/
  phone, address, and bank details all existed correctly in the schema and
  API (and were correctly masked) but had no way to be entered through the
  UI. The Customers create form only exposed `companyId`, `name`,
  `category` and `contactPhone` — email and address were the same kind of
  gap. Both fixed by expanding the create forms to every field their
  respective APIs accept.

FR-CUST-01 (profile/contact/category), FR-CUST-02 (credit limit/payment
terms — already editable from a separate detail panel), FR-SUPP-01
(profile/category/contact) and FR-SUPP-03 (blacklist/unblacklist) were
already correctly implemented. FR-CUST-03's statement remains honestly
empty (documented since an earlier update) and FR-SUPP-02's document
upload remains deferred, for the reasons above.

Re-verified end-to-end: a curl create with contract fields populated
round-trips correctly; a supplier update produces a matching
`supplier.record.updated` audit entry with bank/tax fields confirmed absent
from the payload; masking was re-checked with the Managing Director account
(`supplier.viewAll` but not `supplier.view.sensitive`) to confirm bank
fields still read as `•••• restricted ••••` while `contractReference`
(non-sensitive) is visible; and a Playwright pass confirmed both expanded
create forms render their new sections and submit correctly with zero
console errors.

## Sprint 5 verification pass (18 August 2026)

Same method again: re-checked Product Records against
`04_Software Requirements Specification`, Section 4.8 (FR-PROD-01–03).

**Scope note first**: the request that triggered this pass asked for
"Products, categories and warehouses." Section 4.8's own text explicitly
defers "stock locations, warehouses, stock movements and inventory
valuation" to Phase 2 — the same deliberate Phase 1/Phase 2 boundary this
project has held throughout every previous sprint (Sales, Procurement,
Inventory, Expenses, Assets, Projects are all deferred the same way).
Asked how to handle the mismatch, the answer was to keep this pass scoped
to Products/Categories only and treat warehouses as out of scope for
Phase 1, consistent with every other Phase 2+ deferral already documented
— so no warehouse/stock-location code was added this pass.

- **FR-PROD-01** ("registration of products/services") had no way to
  distinguish the two — every record was implicitly a good. Added a
  `productType` enum (`good`/`service`, migration `sprint5_product_type`),
  defaulting to `good` so existing seeded products need no backfill.
- **Audit gaps, same class as Sprint 4's**: `products.service.ts`'s
  `update()` and `createCategory()` never called `AuditService` — only
  `create()` did. Both fixed, following the same
  `product.record.updated`/`product.category.created` naming convention
  already used elsewhere.
- **UI gap, same class as Sprints 3–4's**: the create form only exposed
  company, product code, unit of measure, name and category — `barcode`
  and `description` existed correctly in the schema and API but had no
  form field. Fixed, plus a new Type selector and a Type column on the
  product list so the new field is visible, not just settable.

FR-PROD-02 (barcode) and FR-PROD-03 (unit of measure) were already
correctly modeled at the API level; their gap was UI-only, fixed above.

Re-verified end-to-end: a curl create of a `service`-type product with
barcode and description round-trips correctly; a product update and a
category create each now produce a matching audit entry (previously
silent); and a Playwright pass confirmed the product list's new Type
column and the expanded create form (Type/Barcode/Description) render
correctly with zero console errors.

## Sprint 6 verification pass (18 August 2026)

The request that opened this sprint named "Procurement, purchase orders and
goods received" — none of which appear anywhere in `04_SRS`'s Phase 1 scope
(`FR-SUPP-02`'s own deferred note explicitly pushes "purchase requisitions/
orders" to Phase 2), and none of which match what `17_Development Plan`
actually calls Sprint 6 ("Accounting completion, Dashboard, Audit Trail").
Asked how to handle the mismatch, the choice was to re-verify the actual
Sprint 6 instead — Accounting, Dashboard and Audit Trail — the same method
as Sprints 1–5, rather than starting a new, unscoped Phase 2 module. No
Procurement/PO/GRN code was added.

- **FR-ACC-03** ("maintain a general ledger reflecting all posted journal
  entries") only had a trial balance report — an account-level summary of
  totals, not the transaction-level, running-balance view a general ledger
  actually is. Added `GET /accounting/reports/general-ledger` (per account,
  optionally filtered by period), plus a new General Ledger tab on the
  Accounting screen.
- **FR-DASH-02** ("a summary of the chart of accounts and current trial
  balance status to authorized finance users") was only reachable via
  `accounting.viewAll` — a Group-level-only permission. A subsidiary-scoped
  Finance Manager (`accounting.manage` only, no `accounting.viewAll`) could
  never see it, since the subsidiary dashboard didn't include accounting
  data at all. This is the same demo-reachability class of gap found in
  Sprint 2 (company management) and Sprint 4 (supplier audit): correct code,
  but the specific persona the requirement names — "finance users," not
  just Group-level ones — couldn't reach it. Fixed by including the
  accounting summary in `GET /dashboard/companies/{id}` for anyone holding
  either `accounting.manage` or `accounting.viewAll` for that company.
- **Audit Trail (FR-AUDIT-01–03)**: re-checked, no gaps found beyond what
  was already documented when it was built (representative-subset mutation
  coverage, IP address captured only on `access_denied`). One clarification
  worth recording: `AuditAction`'s `'delete'` value is real but never fires
  anywhere in this codebase — every service uses status changes
  (active/inactive/blacklisted/locked) instead of hard deletes, by design
  (`schema.prisma`'s own header comment: "status-not-hard-delete"), so
  FR-AUDIT-01's "delete" case has nothing to capture in this system as
  built. Not a gap; a fact worth stating rather than leaving implicit.

FR-ACC-01, 02, 04, 05, 06 and FR-DASH-01, 03, 04 were already correctly
implemented. FR-ACC-07 (recurring/adjusting entries, "Could" priority)
remains not started, unchanged from earlier updates.

Re-verified end-to-end: a curl general-ledger request for an account with
posted activity returns a correctly-ordered, correctly-running-balanced
line list; the same request from a user outside the company's scope
correctly returns `NOT_FOUND`; a subsidiary-scoped Finance Manager's own
dashboard now shows the accounting summary that was previously invisible to
that persona; and a Playwright pass confirmed both the dashboard's new
accounting block and the Accounting screen's new General Ledger tab render
and generate correctly with zero console errors.

## Sprint 7: security testing pass (18 August 2026)

The request that opened this sprint named "Sales, invoices and receipts" —
explicitly Phase 2 in `04_SRS`'s own phasing text ("Phase 2: Sales,
procurement, inventory, warehouse, expenses, assets, projects"), and with
no existing code to verify (unlike Sprint 6, which had real code hiding
under a mismatched label). The actual Sprint 7 (`17_Development Plan`) is
"Contract, system and security testing." Asked how to handle the mismatch,
the choice was to run that instead — the natural next step after six
rounds of feature verification, and the first sprint in this project that
tests across the whole system rather than one module at a time.

`10_Test Plan`, Sections 3.3 (Contract Testing) and 3.4 (System/E2E
Testing) are written entirely against the approved Kafka/microservices
architecture (producer/consumer contract tests between independently
deployable services) — inapplicable to this monolith as literally
specified, the same architecture gap noted everywhere else in this
document. Their *spirit* — exercising the whole system through the same
API a real client uses, verifying acceptance criteria — is what every
sprint's curl + Playwright verification has already been doing since
Sprint 1.

Section 3.5 (Security Testing) does apply regardless of architecture, and
was run against SEC-01–07 and NFR-08/09:

- **SEC-01** (server-side RBAC): confirmed — a Branch Manager scoped to
  Morise Agro Ltd requesting Morise Logistics Ltd's company record by
  direct URL gets `NOT_FOUND`; the same user attempting to self-assign a
  role via a direct API call gets `FORBIDDEN`.
- **SEC-02** (SQL injection / XSS): confirmed prevented. A `'; DROP TABLE
  companies; --` payload and a `<script>alert(1)</script>` payload were
  both submitted as a company name — Prisma's parameterized queries store
  them as inert literal strings (verified: the companies table was intact
  afterward), and a Playwright pass confirmed the XSS payload renders as
  literal text in the UI with zero `alert()` dialogs firing, since the
  frontend uses React's default auto-escaping everywhere (no
  `dangerouslySetInnerHTML` anywhere in the codebase).
- **SEC-03** (CSRF protection): structurally not applicable rather than
  separately implemented — this API authenticates via a Bearer token in
  the `Authorization` header, never cookies, so the browser never
  auto-attaches credentials the way CSRF's attack model depends on. Worth
  stating explicitly rather than leaving silent.
- **SEC-04** (file upload validation): not applicable — this system has no
  file upload endpoint anywhere (the same deliberately-deferred gap
  already noted for Company logos, Employee/Supplier documents).
- **SEC-05** (rate limiting on auth endpoints): already implemented
  (`@Throttle` on login/refresh/password-reset, 10 req/min/IP) — confirmed
  live: the 11th rapid login attempt correctly returns `429`/
  `RATE_LIMITED`. One polish fix made: the response was leaking
  NestJS's raw `ThrottlerException: Too Many Requests` class name as the
  user-facing message; replaced with the same clean wording every other
  error code in this envelope uses.
- **SEC-06** (administrative actions in the audit trail): already
  extensively verified across every sprint's audit-trail checks.
- **SEC-07** (2FA, "Could" priority): not implemented, unchanged — not a
  gap at this priority level.
- **NFR-08** (HTTPS/TLS): not applicable to local development — a
  deployment/infrastructure concern, out of this proof-of-concept's scope.
- **NFR-09** (password hashing): confirmed — `bcrypt`, cost factor 12,
  used consistently across every code path that sets a password.

No Sales/Invoice/Receipt code was added.

## Sprint 8: performance, Alpha and UAT pass — one critical bug found and fixed (18 August 2026)

The request that opened this sprint named "Inventory" — Phase 2 in `04_SRS`'s
own phasing text, with no existing code to verify. The actual Sprint 8
(`17_Development Plan`) is "Performance testing, Alpha testing, UAT begins."
Asked how to handle the mismatch, the choice was to run that instead.

**Critical finding, fixed**: `13_Alpha Test Plan`, Section 5.2's exploratory
checklist item — "no module is reachable by a role that should not have
access to it, discovered by browsing rather than by a scripted attempt" —
caught a real, serious bug during this pass. `employees.service.ts`,
`customers.service.ts`, `suppliers.service.ts` and `products.service.ts`'s
`list()` methods each build their scope filter as: if the caller lacks
group-wide visibility, use the caller's own scoped company IDs — *unless*
the caller supplied an explicit `filter[companyId]` query parameter, in
which case that value was used **verbatim, with no check that it was
actually one of the caller's own scoped companies**. A scoped user (e.g. an
HR Manager scoped only to Morise Logistics Ltd) could pass
`filter[companyId]=<any other company's UUID>` and receive that other
company's real records — for Employees, including unmasked bank account
numbers for anyone holding `employee.view.sensitive` for their own company
(the sensitivity check itself was correct; the scope check feeding it was
not). This is a direct BR-01 violation and exactly the class of defect
Alpha's exploratory testing exists to catch before a scripted security test
would specifically think to try it. All four services now validate
`filter[companyId]` against the caller's actual scope before using it —
an out-of-scope value falls back to the caller's own real scope rather than
being honored, so the endpoint keeps working normally, it just can no
longer be tricked into leaking another company's data. Verified fixed
against all four services with the exact attack that found it, plus
confirmed normal own-scope filtering still works correctly afterward.
`accounting/*`'s equivalent endpoints were checked too and were never
vulnerable — they take `companyId` as a required parameter validated via
`isCompanyInScope()` from the start, a different (and correct) pattern from
the one these four services shared.

Beyond that fix:

- **Performance (`10_Test Plan` Section 3.6, NFR-01/02)**: response times
  measured well under target (dashboard summary ~14ms, trial balance
  ~27ms, list endpoints ~6ms) — but only at seed-data scale. Neither
  `10_Test Plan` nor this pass has a Group-confirmed target concurrent-user
  count or data volume, so this is evidence the code path itself is fast,
  not a validated NFR-01/02 pass under realistic load, exactly as
  `13_Alpha Test Plan`, Section 10's own risk table already anticipates
  ("No confirmed target load ... formal performance testing is the
  authoritative check once a target load is confirmed").
- **Alpha 5.2 (mid-session scope/permission change)**: confirmed — a test
  user was granted a permission directly while already holding an active
  access token; the *same* token (no re-login) immediately gained access,
  confirming every request re-validates roles/permissions/scopes fresh
  against the database rather than trusting a snapshot baked into the JWT.
- **Alpha 5.2 (rapid journal entry posting)**: three journal entries posted
  in quick succession; the trial balance stayed correctly balanced and the
  audit trail captured all three `accounting.journal_entry.posted` events
  with no lost or duplicated entries.
- **Alpha 5.1/5.3 (full regression, operational drills)**: a continuous
  Playwright pass walked all six `12_UAT Plan` scenarios (UAT-01 through
  UAT-06) back-to-back, in the roles each scenario specifies (IT
  Administrator, HR Manager, Sales Manager, Procurement Manager, Finance
  Manager, Auditor, Managing Director), with zero console/page errors
  across the whole session. Section 5.3's operational drills (force-stop a
  service, rollback rehearsal, Grafana/Jaeger/EFK checks) remain not
  applicable — none of that infrastructure exists in this monolith slice,
  unchanged from every earlier update.
- **Alpha 5.4 (access-control spot-check)**: repeated once more post-fix —
  cross-company access and admin-only functions both correctly denied.

No Inventory code was added.

## Sprint 9: Expense Management — the first Phase 2 module (18 August 2026)

Every earlier sprint that named something outside Phase 1 (Sprints 6, 7, 8)
was redirected back to whatever `17_Development Plan`, Section 6 still had
open, because that table still had real, unstarted work behind the
mismatch. This sprint is different: by the end of Sprint 8, every sprint in
that table (0 through 8) was either built or, for the two testing-only
sprints, actually run — Sprint 0 (platform infrastructure) is the only one
left undone, and it's prerequisite infrastructure this monolith
proof-of-concept deliberately never built, not a feature sprint a request
could match. "Expenses" is the first module `04_Software Requirements
Specification`, Section 12 and this README's own "Next steps" name as the
natural next body of work — so, for the first time since Sprint 5, it was
built exactly as asked, not substituted.

That also makes this the first sprint that falls outside the Phase 1
boundary this whole document set was authorized against. Section 2's
phase-gated funding approach ("each phase is separately scoped, budgeted
and approved before it begins," from `01_Project Proposal`, Section 5) was
never run for Phase 2 — no Phase 2 Feasibility Study, SRS pass, or
Development Plan update preceded this work. Built anyway, as a
proof-of-concept extension past the authorized boundary — the Board should
read this sprint as evidence of what's technically buildable, not as
Phase 2 having been formally proposed or approved.

**What was built** — an Expense Service, one more module of the same single
NestJS application every earlier sprint already describes, implementing the
claim workflow `05_Business Process Document`, Section 6.4 and
`morise.docx`, Section 22/48 already specified in detail before this sprint
ever started:

- **Submission** (`FR-EXP-01`): any authenticated user with a company/branch
  scope can submit a claim for themselves — category, description, amount,
  currency, expense date, an optional receipt reference, and an expense
  account (an `Account` of type `expense`) to post against. Gated by a new
  `expense.create` permission, granted to every seeded demo role except
  Auditor, so the read-only guarantee that role documents elsewhere isn't
  broken by self-service claim submission.
- **Two-step approval** (`FR-EXP-03`): `submitted` → `manager_approved`
  (`expense.approve.manager`) → `finance_approved`
  (`expense.approve.finance`), via one state-aware `POST /expenses/{id}/approve`
  endpoint that inspects the claim's current status to decide which
  permission it needs — the only endpoint in this API whose required
  permission isn't fixed per-route.
- **Rejection** (`FR-EXP-04`): `POST /expenses/{id}/reject` with an optional
  reason, available at either approval step to whoever can approve that
  step.
- **Payment, posted to accounting** (`FR-EXP-05`): `POST /expenses/{id}/pay`
  combines the source workflow's separate "Payment/Reimbursement" and
  "Posted to Accounting" steps into one action — this proof-of-concept has
  no separate disbursement system, the same simplification pattern already
  used elsewhere (e.g. Accounting's manual journal entries). It posts a
  balanced two-line journal entry (debit the claim's expense account,
  credit a payment account chosen at pay time) directly into the existing
  Accounting module's ledger and links the claim to the resulting
  `JournalEntry` — the first place in this codebase where one module's
  write path directly creates rows another module owns, a tighter coupling
  than anything else in this monolith (see "Judgment calls," below).
- **Visibility, deliberately narrower than every other module**: `GET
  /expenses` without `expense.viewAll` returns only the caller's own
  submitted claims plus claims currently awaiting whichever approval step
  their permissions cover — not the full in-scope company list every other
  list endpoint in this API returns to any authenticated scoped user.
  Expense claims carry another employee's spending detail, not shared
  master data, so this default is narrower on purpose.
- A new **Expenses** screen (sidebar, between Accounting and Users & Roles):
  a claim list with status badges, a submit form, and per-row Approve/
  Reject/Pay & Post actions gated by role — following the same list+modal
  pattern every earlier screen (Suppliers, Customers, Products) already
  uses. No Administrator/Customer mockup existed for this screen to match,
  unlike every earlier Phase 1 screen — this layout is this sprint's own
  design.

**Permissions added**: `expense.create`, `expense.viewAll` (Super
Administrator, Managing Director, Group CEO, Auditor — read-only, since
Auditor holds no create/approve/pay permission), `expense.approve.manager`
(Super Administrator, Branch Manager, Human Resources Manager, Sales
Manager, Procurement Manager) and `expense.approve.finance` (Super
Administrator, Finance Manager — this one permission also gates pay/post,
matching the single-manage-permission-per-service convention `accounting.manage`
already set). Branch Manager (Kintu's demo persona) previously held *no*
permissions at all, used only to demonstrate BR-01 scoping; Expenses is the
first capability that role can actually exercise.

**Verified end-to-end** with a curl matrix (a live browser pass was not
available this session — the browser tool was declined, so this is API-level
verification only, an honest gap against the Playwright coverage every
earlier sprint's update was able to report):

- Full workflow: a claim submitted by Kintu was manager-approved by Namuli,
  finance-approved and paid by Smith, producing a `JE-2026-0004`-style
  journal entry that balances exactly to the claim amount, confirmed
  against `GET /accounting/journal-entries`.
- Permission gating at every step: Kato (holds `expense.approve.manager`
  only) correctly receives `FORBIDDEN` calling `/approve` once a claim
  reaches `manager_approved`, and calling `/pay`; Nassuna (Auditor, holds
  only `expense.viewAll`) correctly receives `FORBIDDEN` calling `POST
  /expenses` to create one.
- State-machine guards: approving a `rejected` claim, or paying an
  already-`paid` claim, both correctly return `CONFLICT` rather than a
  silent no-op.
- **BR-01 scope isolation, checked proactively** against Sprint 8's own
  critical finding rather than waiting for a future Alpha pass to catch it:
  Nakato (HR Manager, scoped only to Morise Logistics Ltd) correctly
  receives an empty list and `NOT_FOUND` requesting a Morise Agro Ltd claim
  by direct ID.
- Full audit trail coverage: every submit/approve/reject/pay call produces
  its matching `expense.claim.*` event, confirmed via `GET /audit/logs`.
- A real bug was found and fixed during this verification pass, not before
  it: the first cut of `list()`'s visibility filter only showed
  `manager_approved` claims to an `expense.approve.finance` holder, so a
  claim they had just finance-approved would disappear from their own list
  before they could find it again to pay — fixed to include
  `finance_approved` in that same visibility set.

No Sales/Procurement/Inventory/Assets/Projects code was added — Sprint 9
built Expenses only, the one Phase 2 module actually requested.

## Sprint 10: Full Accounting (18 August 2026)

**A discovery that reframes Sprints 6 through 9**: this sprint's request
("Accounting") sent a search through the whole document set for where
"Sprint 10" is actually named, the same check every sprint since Sprint 6
has run against `17_Development Plan`. This time the hit wasn't in that
document — it was in
`Multi_Holdings_Limited_Software_Development_Procedures.docx`, Section 12
("Phase 10 — Recommended Development Order"), which contains its own
literal 14-sprint table, independent of `17_Development Plan`'s Sprint
0–8 schedule:

| Sprint | Deliverable |
|---|---|
| 1 | Authentication, users, roles and permissions |
| 2 | Holding company, subsidiaries, branches and departments |
| 3 | Employees and HR |
| 4 | Customers and suppliers |
| 5 | Products, categories and warehouses |
| 6 | Procurement, purchase orders and goods received |
| 7 | Sales, invoices and receipts |
| 8 | Inventory |
| 9 | Expenses |
| 10 | **Accounting** |
| 11 | Assets |
| 12 | Projects |
| 13 | Reports |
| 14 | Dashboard, notifications and audit trail |

Every single sprint request across this project's entire history — Sprints
1 through 9, and now 10 — matches this table's wording exactly, including
the ones earlier updates called "mismatches" (Sprint 6's "Procurement,
purchase orders and goods received," Sprint 7's "Sales, invoices and
receipts," Sprint 8's "Inventory"). Those weren't mismatches against *the*
plan — they were mismatches against `17_Development Plan`'s own,
differently-scoped Phase-1-only numbering, while matching this table the
whole time. This document wasn't checked until now. The work already done
in Sprints 6–8 (security testing, performance/Alpha/UAT) was reasonable and
valuable regardless — `17_Development Plan`'s Sprint 6/7/8 genuinely needed
running, and still do — but it's worth recording plainly that Procurement,
Sales and Inventory (this table's actual Sprints 6–8) remain entirely
unbuilt, not because they were redirected away from for a good reason
discovered at the time, but because the reason given then was incomplete.
Nothing already built is being undone or relitigated here; this is a
correction to the record, not a rollback.

**What "Accounting" means for Sprint 10, given the module already exists**:
unlike Sprint 9 (a wholly new module), Basic Accounting (`EPIC-09`) was
built in Phase 1 and already had one revisit (Sprint 6). "Full Accounting"
was read as deepening the existing module along three lines already visible
in the source documents, not rebuilding it:

- **FR-ACC-07** ("recurring and adjusting journal entries") — flagged
  "Could priority, not started" every time it's been mentioned since the
  module was first built, and never picked up until now.
- **Financial statements** (Income Statement, Balance Sheet) —
  `04_Software Requirements Specification`, Section 12 lists "financial
  statements" and "consolidated accounting" under Phase 3, not Phase 1;
  built anyway as a Phase 3 pull-forward, the same judgment call Sprint 9
  made pulling Expense Management forward from Phase 2.
- **Group-consolidated reporting** — ties directly to the Company
  parent/subsidiary hierarchy this system already has from Sprint 2, and is
  the most literal reading of "consolidated accounting" available.

**What was built**:

- `RecurringJournalEntry` + `RecurringJournalEntryItem`: a saved line-item
  template (not a cron-scheduled job — no scheduler infrastructure exists in
  this proof-of-concept). `POST /accounting/recurring-entries/{id}/generate`
  clones the template into a new **draft** `JournalEntry`, which then goes
  through the exact same `POST .../journal-entries/{id}/post` endpoint (and
  its BR-03/BR-04 balance and period-closed checks) every manually-created
  entry already uses — no duplicated validation logic. Gated by the
  existing `accounting.manage` permission; no new permission was needed
  since this deepens an existing service rather than adding a new one.
- `GET /accounting/reports/income-statement` (period-bound: revenue/expense
  accounts only, posted entries within one financial period) and
  `GET /accounting/reports/balance-sheet` (point-in-time as of a date:
  asset/liability/equity accounts, cumulative since company inception —
  correct balance-sheet semantics, unlike the period-bound trial balance/
  income statement). The balance sheet includes a synthetic **"Net Income
  (Current Period, Unposted)"** equity line — the running total of revenue
  minus expense up to that date — because this system has no formal
  period-close/retained-earnings-rollover process (`BR-04` only closes a
  period against further posting; it doesn't roll net income into equity).
  Without that line, Assets would never equal Liabilities + Equity for any
  company with posted revenue/expense activity.
- **`?consolidated=true`** on both report endpoints: sums the same report
  across a root company and every subsidiary beneath it
  (`Company.parentCompanyId`, walked breadth-first). Deliberately does
  **not** merge each subsidiary's chart of accounts line-by-line — each
  company's chart of accounts is independent, matching
  `08_Database Design Document`'s per-service/no-shared-schema stance, so
  merging by account code would silently conflate unrelated accounts that
  happen to share one. Instead it returns each included company's own
  report untouched under `by_company`, plus one combined `consolidated`
  totals object, and an `excluded_companies` list (with a stated reason)
  for any subsidiary that couldn't be matched in — no silent gaps. No
  currency conversion is applied.
- Three new Accounting screen tabs — **Income Statement**, **Balance
  Sheet**, **Recurring Entries** — following the same tab/report pattern
  Trial Balance and General Ledger already established.

**Seed data added**: a full chart of accounts, a matching `FY2026-Q1`
period, and posted revenue/expense/opening-balance journal entries for
**Morise Logistics Ltd** (previously seeded with none at all), specifically
so the consolidated reports have a second real subsidiary to aggregate —
Morise Agro Ltd alone couldn't demonstrate consolidation. A `Monthly Office
Rent` recurring entry template was seeded for Morise Agro Ltd.

**Verified end-to-end** with a curl matrix: generating and posting a
recurring entry correctly increments its `timesGenerated`/
`lastGeneratedAt`; a user without `accounting.manage` (Namuli) correctly
receives `FORBIDDEN` generating one; a user scoped to a different company
(Nakato) correctly receives `NOT_FOUND` on another company's template;
Income Statement and Balance Sheet both return correct figures matching a
parallel trial-balance check, with the balance sheet's `balanced` flag
confirmed `true`; the consolidated variant of both reports, queried from
Morise Holdings Limited (the root holding company, which itself holds no
accounts), correctly aggregates Morise Agro Ltd and Morise Logistics Ltd
while excluding the root with a stated reason
(`No "FY2026-Q1" financial period for this company`); and a
group-scoped-only user (Nakato) correctly receives `NOT_FOUND` attempting
the same consolidated call. A live browser pass was not available this
session — verification here is API-level only via curl, the same honest
gap Sprint 9's update recorded.

**A real bug was found and fixed during this pass**: the first cut of the
consolidated income-statement endpoint required the caller's `periodId` to
belong to the root `companyId` — but a pure holding company frequently has
no financial periods of its own, since nothing is ever booked directly
against it (exactly Morise Holdings Limited's own seed data). That made
`?consolidated=true` from the holding company impossible to call at all.
Fixed: for a consolidated request, `periodId` only needs to belong to a
company the caller can see; its `periodName` (not its ID) is what gets
matched against every subsidiary.

**Two environment issues hit and resolved during this pass, not code
bugs**: (1) `nest start --watch`'s `deleteOutDir` setting raced its own
compile step — `dist/main.js` was being required before (or instead of)
being written, crashing the dev server on every restart regardless of a
correct `tsconfig.tsbuildinfo` cleanup; worked around for the rest of this
session by compiling once with `npx tsc -p tsconfig.json` and running
`node dist/main.js` directly, losing hot-reload but gaining reliability.
(2) Sprint 9's own interactive curl verification had left extra
journal entries in the local dev Postgres database with the same
sequential entry numbers (`JE-2026-0002`, etc.) this sprint's seed script
independently generates, so the seed script's own idempotency check
(`findFirst` by `entryNumber`) silently skipped seeding the new revenue
entry it needed. Resolved by resetting the local dev database
(`docker compose down -v && up -d`, then `migrate deploy` and `seed.ts`
fresh) rather than patching around stale interactive-session data — the
correct fix for local-dev-only state, not a change to any migration or
seed logic.

No Sales/Procurement/Inventory/Assets/Projects code was added — Sprint 10
deepened Accounting only, the one module actually requested.

## Sprint 11: Asset Management (18 August 2026)

This sprint's request ("Assets") matches `Multi_Holdings_Limited_Software_Development_Procedures.docx`'s
own Sprint 11 directly — no redirect needed, the same as Sprint 10. Asset
Management is explicitly Phase 2 scope (`04_Software Requirements
Specification`, Section 12); built anyway, pulled forward the same way
Expense Management (Sprint 9) was.

**What was built** — an Asset Service, built against the workflow
`05_Business Process Document`, Section 6.5 and `morise.docx`, Section 15
already described ("Purchase Approved → Asset Registered → Category,
Location & Custodian Assigned → Depreciation Schedule Set → Asset Active",
and for disposal, "Disposal Request → Management Approval → Asset
Inspection → Disposal Executed → Asset Record Closed" — Inspection folded
into the Management Approval step as an `inspectionNotes` field, the same
step-combining simplification Expense's `pay()` already made):

- **Registration** (`FR-ASSET-01`): asset number, name, category,
  description, location (branch), custodian (a logical reference to an
  Employee record, validated against the company at write time), purchase
  date/cost, optional straight-line depreciation configuration (useful
  life, salvage value, and three optional GL account links: Fixed Assets,
  Depreciation Expense, Accumulated Depreciation), optional insurance
  fields (insurer, policy number, expiry date), and a `documentReference`
  text field standing in for real document upload — the same deferred
  object-storage gap noted throughout this project.
- **Transfer** (`FR-ASSET-02`): relocate an asset's branch and/or custodian
  — a physical event, not a financial one, so no GL posting.
- **Depreciation** (`FR-ASSET-03`): `POST /assets/{id}/record-depreciation`
  posts a balanced entry (debit Depreciation Expense, credit Accumulated
  Depreciation) and increases the asset's own running total. Rejects any
  amount that would push accumulated depreciation past depreciable cost
  (purchase cost minus salvage value) — an asset can't depreciate below its
  salvage value.
- **Disposal** (`FR-ASSET-04`), a three-step state machine matching the
  source workflow: `request-disposal` → `approve-disposal` (Management
  Approval + Inspection) → `dispose` (Disposal Executed). Disposal posts a
  full derecognition entry — credit Fixed Assets for the original cost,
  debit Accumulated Depreciation for what's been taken so far, debit the
  proceeds account for anything received, and plug the difference to a
  caller-chosen gain/loss account (credited if a gain, debited if a loss)
  — balanced by construction, the same way Expense's `pay()` is.
- **Maintenance records** (`FR-ASSET-05`): a simple log (date, description,
  optional cost) attachable to any asset; if a cost, expense account,
  payment account and period are all supplied, it also posts a balanced
  entry the same way depreciation does. Cost is optional — a routine
  inspection with no cost can be logged with no GL impact at all.

**Permissions**: `asset.manage` (register/update/transfer/record
depreciation/request disposal/log maintenance — granted to Super
Administrator, Finance Manager, and Procurement Manager, since
`05_Business Process Document`'s own workflow starts asset registration
from "Purchase Approved (via Procurement Workflow)"), `asset.viewAll`
(Super Administrator, Managing Director, Group CEO, Auditor — read-only
for the Auditor, same convention as `expense.viewAll`), and
`asset.approve.disposal` (Super Administrator, Finance Manager, **Managing
Director** — the source workflow's second disposal step is literally named
"Management Approval," making Managing Director the most direct match of
any seeded role).

**Seed data**: three new GL accounts for Morise Agro Ltd (Fixed Assets,
Accumulated Depreciation, Depreciation Expense, plus Gain/Loss on Disposal
accounts), and three assets at three different lifecycle stages — a fresh
`active` vehicle (a live target for demoing "Record Depreciation"), a
partially-depreciated laptop already at `disposal_requested` (a live
target for "Approve Disposal" then "Dispose"), and a fully `disposed`
printer with a real posted derecognition entry, demonstrating the complete
lifecycle at a glance — the same three-stages-at-once seeding pattern
Sprint 9 used for expense claims.

**Verified end-to-end** with a curl matrix: asset creation correctly
rejected for a user without `asset.manage`; cross-company scope isolation
holds (a Logistics-scoped user receives `NOT_FOUND` on an Agro Ltd asset);
recording depreciation posts a correctly-balanced entry and correctly
rejects an amount that would exceed depreciable cost with `CONFLICT`;
the full disposal workflow was walked end-to-end (Kato requests →
`asset.approve.disposal`-lacking Kato correctly refused approving his own
request with `FORBIDDEN` → Managing Director approves with inspection
notes → Finance Manager disposes, producing a correctly-balanced
four-line derecognition entry); and maintenance records were verified both
with and without GL posting.

**A real usability finding, not a bug, worth recording**: during
verification, a disposal was tested by passing the seeded "Gain on
Disposal" (revenue-type) account as `gainLossAccountId` for a transaction
that was actually a **loss** — the API correctly debited that account by
the loss amount anyway (it doesn't validate that the account's type
matches the computed sign; it trusts the caller, the same way
`journal-entries` trusts a manual entry's account choices). The ledger
still balanced perfectly, but debiting a revenue-labeled account is poor
bookkeeping hygiene even though it isn't a system error. Fixed at the UI
layer, not the API: the Dispose modal now computes and displays the
gain/loss live, labeled explicitly ("This is a **gain/loss** of ..."), so
the user picks the correct account before submitting — the API itself is
left permissive by design, matching how manual journal entries already
work.

No Sales/Procurement/Inventory/Projects code was added — Sprint 11 built
Assets only, the one module actually requested.

## Sprint 12: Project Management (19 August 2026)

This sprint's request ("Projects") matches
`Multi_Holdings_Limited_Software_Development_Procedures.docx`'s own Sprint
12 directly — no redirect needed, the same as Sprints 10 and 11. Project
Management is explicitly Phase 2 scope (`04_Software Requirements
Specification`, Section 12); built anyway, pulled forward the same way
Expense Management (Sprint 9) and Asset Management (Sprint 11) were.

**What was built** — a Project Service, built against the workflow
`05_Business Process Document`, Section 6.6 and `morise.docx`, Section 17
already described: "Project Registered → Manager & Team Assigned → Budget
Allocated → Tasks Assigned & Tracked → Progress & Expenses Recorded →
Project Reviewed for Profitability → Project Closed":

- **Registration** (`FR-PROJ-01`): project code, name, description,
  location (branch), manager (a logical reference to an Employee record),
  start/planned-end dates, and a budget.
- **Team & Tasks** (`FR-PROJ-02`): team members (employee + freeform role,
  add/remove — the join-table upsert-on-add / hard-delete-on-remove
  pattern, a deliberate exception to this codebase's otherwise universal
  status-not-hard-delete convention, since a team assignment is a join
  record with no standalone history value, the same class as `RolePermission`/
  `UserRole`, which already cascade-delete) and tasks (name, optional
  assignee, status, due date).
- **Milestones** (`FR-PROJ-03`): name, optional due date, a single
  `complete` action.
- **Progress & Expenses Recorded** (`FR-PROJ-04`) — deliberately **not** a
  new expense concept: `Expense` (Sprint 9) gained an optional `projectId`,
  so an expense claim can be attributed to a project at submission time and
  flow through the exact same submit → approve → approve → pay workflow
  already built, with no new approval logic. A project's actual cost is
  simply the sum of its own `paid` expense claims.
- **Reviewed for Profitability** (`FR-PROJ-05`):
  `GET /projects/{id}/profitability` returns budget, actual cost (summed
  from linked paid expenses), budget variance, a manually-recorded
  `revenueAmount` (no invoicing module exists yet to generate this
  automatically — Sales/Invoicing remains unbuilt, per every earlier
  sprint's scope notes), margin, and margin percent.
- **Closed** (`FR-PROJ-06`): five explicit status-transition endpoints
  (`activate`, `hold`, `resume`, `complete`, `close`) rather than a generic
  status `PATCH`, matching the same auditable-named-action convention
  Expense's `approve`/`reject`/`pay` and Asset's disposal workflow already
  use. `close` stamps `actualEndDate`.

**Permissions**: `project.manage` (Super Administrator, Managing Director,
Finance Manager — "Project Reviewed for Profitability" is squarely
financial/executive oversight, the same reasoning already given for
`accounting.manage` and `asset.manage`) and `project.viewAll` (adds Group
CEO and Auditor, read-only for the latter, the same convention as every
earlier `*.viewAll` permission). No `Project Manager` role from the
catalogue was activated — every permission was granted to existing seeded
demo personas only, the same minimal-footprint choice made throughout this
project rather than introducing a ninth demo login.

**Seed data**: two projects for Morise Agro Ltd — "Warehouse Expansion —
Kira HQ" (`active`, a two-person team, one done and one in-progress task, a
pending milestone — a live target for exercising every workflow action)
and "Agro Export Contract — Kenya" (already `closed`, with a real `paid`
expense claim (480,000 UGX) attributed to it via the new `projectId` field,
budget 15,000,000 and revenue 22,000,000 — demonstrating the profitability
calculation end to end: a 97.8% margin, confirmed by curl).

**Verified end-to-end** with a curl matrix: project creation and every
mutating action correctly gated by `project.manage` (a Sales Manager
without it receives `FORBIDDEN` on every attempt); BR-01 scope isolation
holds; the full five-step status transition was walked in order
(`activate` on an already-active project correctly blocked by the
permission gate before the state check even runs; `hold` → `resume` →
`complete` → `close`, with `actualEndDate` correctly stamped only on
`close`); milestone completion is idempotent (`CONFLICT` on a repeat
`complete` call); and the profitability endpoint returned figures that
exactly matched a hand-calculation from the seeded budget/expense/revenue
data. Both the backend build and a full frontend production build
(`npm run build`, 50 modules) completed with zero errors — a live
click-through was not attempted this session, matching the curl-only
verification method every sprint since Sprint 9 has used.

No Sales/Procurement/Inventory code was added — Sprint 12 built Projects
only, the one module actually requested. Every Phase 2 module this
project's own 14-sprint order (Section 12 of
`Multi_Holdings_Limited_Software_Development_Procedures.docx`) names
except Sales (Sprint 7), Procurement (Sprint 6) and Inventory (Sprint 8)
is now built: Expenses (9), Accounting deepening (10), Assets (11),
Projects (12). Reports (13) and Dashboard/notifications/audit refinement
(14) remain, along with the three sprints skipped early in this project's
history for the reason Sprint 10's update explains.

## Sprint 13: Reports (19 August 2026)

This sprint's request ("Reports") matches
`Multi_Holdings_Limited_Software_Development_Procedures.docx`'s own Sprint
13 directly — no redirect needed, the same as Sprints 10 through 12. Unlike
every Phase-2 pull-forward sprint before it, this one lands squarely inside
Phase 1: `04_Software Requirements Specification`, Section 8 already
defines RPT-01 through RPT-06 ("Reporting Requirements") from the very
first version of that document — they were simply never built. This is the
first sprint since Sprint 6 whose scope was already fully specified before
the sprint began, with nothing to pull forward from a later phase.

**What each RPT requirement actually needed, once checked individually**:
RPT-01 (company/branch listing), RPT-02 (employee listing), RPT-03
(customer/supplier listings), and RPT-04 (chart of accounts / trial
balance) all already existed *as data* — every one is already returned by
an existing list/report endpoint (`GET /organization/companies`,
`/employees`, `/customers`, `/suppliers`, `/accounting/accounts`,
`/accounting/reports/trial-balance`). RPT-05 (a filterable audit trail
report) is `GET /audit/logs`, already filterable exactly as specified. The
one genuinely unbuilt piece, RPT-06 ("Reports shall be exportable to at
least PDF and Excel/CSV"), is what this sprint actually added: **export**,
not new data access.

**What was built** — a new `Reports` module (`GET /api/v1/reports/*`)
wrapping each of the five report types above in a shared, consistent
export layer, rather than duplicating each module's underlying query
logic. Every report endpoint:

- Enforces **the exact same permission its underlying data already
  requires elsewhere** — `organization.company.viewAll` for the company/
  branch report (matching the real Companies screen's own restriction),
  `employee.manage`/`employee.viewAll` for employees, `audit.view` for the
  audit trail, and scope-only (no extra permission) for customers,
  suppliers and the accounting report, mirroring each source endpoint's
  real access rule precisely. A reporting layer that quietly loosened
  access to data a role couldn't otherwise see would be a real security
  bug, not a convenience — this was checked endpoint by endpoint against
  each module's actual `@RequirePermission` decorator (or absence of one)
  before writing a single report route.
- Accepts `?format=csv|pdf` (default: structured JSON via the normal
  `{data,error}` envelope, for programmatic/UI consumers that don't want a
  file). CSV is a plain RFC-4180-style writer (no dependency — Excel opens
  it natively, satisfying the "Excel/CSV" half of RPT-06). PDF uses
  `pdfkit` (newly added to `package.json` — the one new runtime dependency
  any sprint in this project has introduced) to render a simple, real,
  landscape-orientation tabular PDF — confirmed a valid PDF document via
  the `file` command during verification, not just a 200 response.
- Bypasses the global response-enveloping interceptor for file exports via
  Fastify's `@Res({ passthrough: false })`, sending the CSV/PDF directly
  with a `Content-Disposition: attachment` header — the JSON path still
  goes through the normal envelope untouched.

**Frontend**: a new Reports screen — pick a report type, fill in whatever
filters that type needs (company, financial period, or a date range),
**Generate** for an on-screen preview table, or **Export CSV**/**Export
PDF** to download the file directly, via a new `downloadReport()` helper
in `lib/api.js` (the existing `apiRequest()` always parses the response as
JSON, which can't handle a binary file — this fetches a `Blob` and
triggers a normal browser download instead).

**A real pre-existing data bug found and fixed during this sprint's own
verification, not a Reports bug itself**: the company/branch report showed
both Morise Agro Ltd and Morise Logistics Ltd — real, wholly-owned
subsidiaries — labeled "holding" instead of "subsidiary." The cause: Sprint
2 added the `relationshipType` field for FR-COMP-03, but the seed script's
two subsidiary companies were created earlier in this project's history
and were never backfilled with it, leaving both silently `null` in the
database since Sprint 1 — invisible everywhere else because no existing
screen displays `relationshipType` as prominently as a report column does.
Fixed in `seed.ts` (both companies now seed with
`relationshipType: 'subsidiary'`, `ownershipPercent: 100`) rather than
worked around in the report's own display logic, since the underlying data
was actually wrong, not just displayed awkwardly.

**Verified end-to-end** with a curl matrix across every report: JSON
preview, CSV export, and PDF export all confirmed for the company/branch,
employee, customer, supplier, and accounting reports; permission gating
confirmed correct for every report (a Sales Manager without
`employee.manage`/`employee.viewAll` correctly receives `FORBIDDEN` on the
employee report and without `audit.view` on the audit trail report, while
the same user correctly succeeds on the customer/supplier reports, which
require only scope); and the trial balance variant of the accounting
report was cross-checked against `/accounting/reports/trial-balance`
itself for the same company/period and matched line for line. Both the
backend build and a full frontend production build (51 modules) completed
with zero errors — a live browser pass was not attempted this session,
the same curl-only verification method every sprint since Sprint 9 has
used.

No Sales/Procurement/Inventory code was added — Sprint 13 built Reports
only, the one module actually requested. Of `Multi_Holdings_Limited_
Software_Development_Procedures.docx`'s 14-sprint order, only Sales
(Sprint 7), Procurement (Sprint 6), Inventory (Sprint 8), and
Dashboard/notifications/audit refinement (Sprint 14) remain unbuilt.

## Sprint 14: Dashboard, Notifications and Audit Trail (19 August 2026)

This sprint's request ("Dashboard, notifications and audit trail") matches
`Multi_Holdings_Limited_Software_Development_Procedures.docx`'s own Sprint
14 — the last row in that table — directly. Unlike every earlier sprint,
this one names three things at once, two of which (Dashboard, Audit Trail)
were already built in Phase 1 and revisited once already (Sprint 6). Only
**Notifications** was genuinely unbuilt — explicitly deferred in this
README since Sprint 1 ("Deliberately deferred: ... Notifications"). So this
sprint split three ways: build Notifications from nothing, deepen Dashboard
to cover the four Phase 2 modules built since Sprint 6, and **verify**
(not rebuild) Audit Trail's coverage of those same four modules.

**Audit Trail, verified not rebuilt**: every mutating action across
Expenses (Sprint 9), Assets (Sprint 11) and Projects (Sprint 12) already
calls `AuditService.record()` — checked by grepping every `eventType:` in
all three services' source directly, not assumed. 20 distinct event types
across the three modules, every one of them a real mutation (create,
update, approve, transition), not a representative subset — better
coverage than Phase 1's own "at least one mutation per service" baseline
this README's "Next steps" has named as outstanding since Sprint 8. No
gap found; no code changed.

**Dashboard, deepened**: `GET /dashboard/summary` (group-level) gained
`assets` (not-disposed count) and `activeProjects`, closing the same kind
of "built module invisible on the dashboard" gap Sprint 6 already fixed
once for FR-DASH-02. `GET /dashboard/companies/{id}` (subsidiary-scoped)
gained three new sections, each conditional on the caller actually holding
a permission for that module in that company (the exact FR-DASH-02
pattern, extended, not a new one): an `assets` summary (total/active/
pending disposal approval), a `projects` summary (total/active), and — new
this sprint, not present in any earlier Dashboard section — `myPendingApprovals`
(expense claims and asset disposals specifically awaiting *this caller's*
next action) and `unreadNotifications`.

**What was built for Notifications** — an in-app feed only
(`morise.docx`, Section 39, "Workflow notifications" specifically; email/
push/SMS channels the same section also lists remain deferred, no SMTP or
push provider exists in this proof-of-concept, the same class of gap
already noted for object storage and a job scheduler):

- A `Notification` model (recipient, type, title, message, an optional
  linked entity, read/unread) and `GET/POST /api/v1/notifications/*`
  (list own, unread count, mark one read, mark all read) — no permission
  gate beyond being logged in, since a notification is inherently personal
  and always scoped to `userId` server-side, never a caller-supplied
  parameter.
- `NotificationsService.findUsersWithPermissionInCompany()`: given a
  company and a permission code, resolves every active user who both holds
  that permission (via role or direct grant) and can actually see that
  company (either a `UserScope` row for it, or a supplied group-visibility
  permission override).
- Wired into two existing approval-gated workflows as a demonstration of
  the pattern, not exhaustive coverage of every event in the system: an
  expense claim notifies manager-approvers on submission and finance-
  approvers once manager-approved (and the original submitter once
  finance-approved); an asset disposal request notifies disposal-approvers,
  and the original requester once disposal is executed. Extending the same
  pattern to recurring-entry generation, project milestones and every
  other workflow step is natural follow-up work, not started this sprint —
  the same "representative subset, not literally everything" honesty this
  project has applied to Audit Trail coverage since Sprint 1.
- Frontend: a notification bell in the top bar (unread badge, polled every
  20s), opening a dropdown feed with click-to-mark-read and a mark-all-read
  action. Dashboard gained the new Assets/Projects/pending-approvals
  sections above.

**A real targeting bug found and fixed during this sprint's own
verification**: the first cut of `findUsersWithPermissionInCompany()`
only matched users with an explicit `UserScope` row for the target
company — so Managing Director (who holds `asset.approve.disposal` and
sees every company via `asset.viewAll`, a *permission*, not a scope row)
was silently never notified of a disposal request on a subsidiary they
have no explicit scope row for, even though they can act on it. Confirmed
directly: a live disposal request produced zero notifications for
Managing Director before the fix, one after. Fixed by adding an explicit
group-visibility-permission override parameter, resolved once across every
active user in the system rather than per-caller (this helper serves a
system-wide fan-out, not one logged-in user's own view) — the same class
of gap Sprint 6 already found and fixed once for Dashboard's FR-DASH-02
(a Group-level permission not being recognized as covering a
company-specific view), now found a second time in a different module.

**Verified end-to-end** with a curl matrix across the full session: expense
submission correctly notifying every manager-approver scoped to that
company (including a self-notification when the submitter also holds
manager-approval permission for their own company — the same known
self-approval gap Sprint 9 already documented, now visible as a
self-notification too, not a new issue); the manager-approval → finance-
approval → submitter-notified chain confirmed in order; asset disposal
request correctly notifying both a company-scoped approver and a
group-visibility approver after the fix above; per-user notification
isolation (a user cannot mark another user's notification read — confirmed
`NOT_FOUND`, not silently succeeding or leaking existence); and the
Dashboard's new fields cross-checked against direct list/count queries for
the same company. Both the backend build and a full frontend production
build (51 modules) completed with zero errors — a live browser pass was
not attempted this session, the same curl-only method every sprint since
Sprint 9 has used.

This closes Dashboard/Notifications/Audit Trail — Sprint 14, the last row
in `Multi_Holdings_Limited_Software_Development_Procedures.docx`'s own
14-sprint order. Of that order, only Procurement (Sprint 6), Sales
(Sprint 7) and Inventory (Sprint 8) remain genuinely unbuilt — the three
sprints redirected away from early in this project's history, for the
reason Sprint 10's update explains in full.

## Company and Holdings Management: policies, inter-company transactions and cross-company asset transfers (19 August 2026)

This update was requested directly against `morise.docx`, Section 2
("Company and Holdings Management")'s full feature list, not framed as a
numbered sprint. Cross-checking every bullet in that list against what
Sprint 2 (companies/branches/departments/ownership) and later sprints
already built found most of it already done — hierarchy, ownership
structure, registration/tax/address/contact fields, logos-as-document-
references, per-company currency and financial years (`FinancialPeriod`),
per-company departments and users all existed since Sprint 2 or Sprint 10.
Four items were genuinely missing: **company-specific policies**,
**inter-company transactions**, **resource transfer between companies**,
and **consolidated group comparison reporting**. All four were built this
pass, on top of the existing Organization/Assets/Reports services rather
than as a new module — each is a natural extension of something that
already existed.

**Company-specific policies** (`organization.company.manage` for writes,
same scope-check as branches/departments): a `CompanyPolicy` model
(name, description, `policyType`, an optional `documentReference` text
field — no object storage exists in this proof-of-concept, the same
documented gap as every other file-upload field since Sprint 1 — effective
date, active/inactive status) and `GET/POST /organization/companies/{id}/
policies` + `PATCH /organization/policies/{id}`, following
`BranchesService` exactly. Frontend: a Policies section on the Company
Detail page, alongside Branches and Departments.

**Inter-company transactions** (new `organization.intercompany.manage`/
`.viewAll` permissions — deliberately **group-wide only**, no scoped
variant, since a transaction by definition touches two companies at once
and there's no single company whose scope could correctly gate it): an
`InterCompanyTransaction` model (from/to company, type — loan, transfer,
service charge, cost allocation, other — amount, currency, description,
draft/posted status) with a two-step create-then-post flow. **Posting**
generates two independently-balanced `JournalEntry` records under BR-03,
one per company, linked through caller-chosen "due from"/"due to" clearing
accounts — not a single cross-company entry, which no real chart of
accounts supports. `GET/POST /organization/inter-company-transactions`,
`GET /:id`, `POST /:id/post`. Two GL accounts were seeded to demonstrate
this ("Due from Morise Logistics Ltd" on Agro, "Due to Morise Agro Ltd" on
Logistics — the first liability-typed account seeded anywhere in this
project), plus one fully-posted demo transaction (a 2,000,000 UGX loan,
Agro → Logistics). Frontend: a new **Inter-Company** page (list, create,
and a post modal that independently loads accounts/open periods for both
companies).

**Resource transfer between companies**: rather than a new endpoint,
`AssetsService.transfer()` (Sprint 11) gained an optional `toCompanyId`.
When set and different from the asset's current company, it validates the
destination company exists and the caller has
`organization.intercompany.viewAll` scope there too (both companies must
be in scope, not just the source — the same reasoning as the transactions
endpoints above), then moves the asset's `companyId` and clears its GL
account links (asset/depreciation-expense/accumulated-depreciation), since
those accounts belong to the old company's chart and would silently
misdirect future depreciation postings otherwise. Frontend: the existing
Transfer modal gained a "Move to different company" field with a warning
about the account-link reset.

**Consolidated group reporting**: a new `GET /reports/company-comparison`
endpoint (`organization.company.viewAll`, reusing Sprint 13's Reports
module and its shared CSV/PDF `respond()` helper rather than building
parallel export logic) lists every company with employee/customer/
supplier/active-asset/active-project counts, and — when a `periodName`
query param is supplied — each company's revenue/expense for that period
matched by financial-period name, plus a `TOTAL (Group)` row. This is
Sprint 10's `?consolidated=true` Income Statement/Balance Sheet rollup's
sibling: that gives one combined P&L across subsidiaries, this gives a
side-by-side comparison of the same subsidiaries plus operational counts
neither report tracks. Frontend: a new "Subsidiary Comparison /
Consolidated Group" entry on the Reports page.

**Two real bugs found and fixed during this pass's own verification, not
assumed away**: `InterCompanyTransactionsService.create()` and `.post()`
initially had no `isCompanyInScope()` check at all on either company —
confirmed live, a Finance Manager scoped only to Morise Agro Ltd was able
to post a transaction touching Morise Logistics Ltd purely because she
happens to hold the group-wide `organization.intercompany.viewAll`
permission. That's arguably correct given the permission's intentionally
group-wide design, but the code had nothing actually enforcing or
documenting that intent — fixed by adding explicit
`isCompanyInScope(actor, companyId, 'organization.intercompany.viewAll')`
checks on both companies in `create()` and `post()`. While fixing those,
`.get()` was found to have **no permission check whatsoever** — any
authenticated user could fetch any inter-company transaction by ID
regardless of scope. Fixed the same way; confirmed afterward with a
`s.namuli@...` (Sales Manager, holds neither intercompany permission)
lookup returning `404 NOT_FOUND`, not the transaction.

**A gap noted, not fixed**: no single seeded demo persona holds both
`asset.manage` and `asset.viewAll`/group-wide scope together, so the
successful cross-company asset-transfer path (permission check passes,
destination-scope check passes, transfer executes) can't be demonstrated
end-to-end with the current seed data — Managing Director has
`asset.viewAll` but not `asset.manage`, and Procurement Manager has
`asset.manage` but is scoped to one company only. Both individual gates
were verified correct in isolation via curl (a same-company transfer by
Procurement Manager succeeds; a cross-company attempt by Managing Director
correctly returns `FORBIDDEN` for lacking `asset.manage`, not the
scope check this pass added). Adding a persona that holds both was judged
out of scope for this pass — the same minimal-footprint reasoning Sprint
12 already applied to not adding a dedicated "Project Manager" login.

Both the backend build and a full frontend production build (52 modules)
completed with zero errors.

## Dashboard Deepening — Holding Company & Subsidiary KPI Set (19 August 2026)

This pass was requested directly against a full Holding Company Dashboard /
Subsidiary Dashboard KPI list — total companies, branches, employees,
customers, suppliers, assets, revenue, expenses, net profit, cash position,
bank balances, outstanding receivables, outstanding payables, current
projects, pending approvals, outstanding loans, inventory value, sales
performance, procurement performance, employee statistics, company
performance comparison, four monthly charts (revenue, expense, profit and
loss, cash flow), and financial/operational alerts — not a numbered sprint
from `Multi_Holdings_Limited_Software_Development_Procedures.docx`'s
Section 12 table (already complete except Sprints 6–8, unchanged) or the
Company and Holdings Management pass immediately above it, from earlier the
same day.

**Schema change**: a nullable `Account.accountSubType` enum
(`cash`/`bank`/`receivable`/`payable`), migration
`sprint15_account_subtype_dashboard`. `accountType` alone (asset/liability/
equity/revenue/expense) can't tell "Fixed Assets" apart from "Cash and
Bank" — both are plain `asset` accounts — so cash position, bank balances,
and outstanding receivables/payables had no way to be computed at all
before this. Seed data tags each company's existing combined "Cash and
Bank" account as `bank` (this proof-of-concept has never split cash from
bank — a documented simplification, not a bug, so the dashboard's Cash
Position and Bank Balances tiles read as the same figure), and adds a new
zero-balance `Accounts Receivable`/`Accounts Payable` account per company —
correctly `0.00` until a Sales/Procurement module exists to ever post to
them, the same schema-ready-but-honestly-empty pattern already established
for `FR-CUST-03`'s empty customer statement.

**What was built**, no new permissions needed anywhere (every new block
reuses `accounting.viewAll`, `organization.company.viewAll`, or
`organization.intercompany.manage`/`.viewAll`):

- **`GET /dashboard/financials`** (`accounting.viewAll`): group-wide total
  assets/liabilities/equity, cash position, bank balances, outstanding
  receivables/payables, and total revenue/expense/net profit — each
  company's own currently-open (or, if none open, most recently closed)
  financial period, not one shared period name, unlike the Reports
  module's `?consolidated=true` (which needs every company on the same
  named period for an apples-to-apples comparison — a "what's the current
  position right now" snapshot doesn't). Includes a `byCompany` breakdown,
  which the frontend also renders as a **Company Performance Comparison**
  table.
- **`GET /dashboard/charts`** (`accounting.viewAll`): four monthly series,
  trailing 6 months, group-wide — revenue, expense, profit-and-loss
  (derived), and cash-flow (a simplified operating-cash proxy: net monthly
  debit-minus-credit movement through `cash`/`bank`-subtype accounts, not a
  full statement of cash flows with financing/investing sections — this
  codebase has no such report anywhere, and building one is out of scope
  for a dashboard chart). Same shape reused per-company inside
  `companyDashboard()`.
- **`GET /dashboard/alerts`** (`organization.company.viewAll`, with the
  financial half additionally gated behind `accounting.viewAll` internally,
  since it exposes ledger data): operational alerts for group-wide pending
  approvals over 5 and asset disposal requests aging past 14 days
  (`Asset.disposalRequestedAt`); financial alerts for a financial period
  open past its end date, a negative net profit for the current period, and
  an unbalanced-ledger sanity check (should never fire given BR-03, but
  worth including). Thresholds are simple fixed constants — this codebase
  has no configurable alert-rule engine and none was asked for.
- **`summary()`** (existing endpoint, `organization.company.viewAll`)
  gained `currentProjects` (by status, not just the existing `activeProjects`
  count), `pendingApprovals` (group-wide expense + asset-disposal totals),
  `outstandingLoans`, and `employeeStatistics`. It also now returns explicit
  `inventoryValue`/`salesPerformance`/`procurementPerformance` blocks shaped
  `{ available: false, reason: "..." }` — labeled and honest, not omitted
  and not faked with a zero, since no Inventory, Sales, or Procurement
  module exists anywhere in this codebase (deliberately deferred since
  Sprints 8/7/6 respectively).
- **`companyDashboard()`** (existing endpoint, FR-DASH-03/BR-01) gained a
  `financials` block and a `charts` block, gated by the exact same
  "authorized users for this company" check the existing `accounting` block
  already uses (`accounting.manage` or `accounting.viewAll` *for that
  company*, not a Group-level-only permission — FR-DASH-02's own Sprint 6
  fix, applied consistently to the new blocks rather than left as a
  precedent that only covered the old ones), and an `outstandingLoans`
  block gated by `organization.intercompany.manage`/`.viewAll`. This system
  has no loan repayment/settlement tracking at all
  (`InterCompanyTransactionStatus` is only `draft`/`posted`, nothing more),
  so "outstanding" here means every posted loan-type inter-company
  transaction this company is a party to — stated plainly, not assumed
  silently. Same explicit not-available blocks for inventory/sales/
  procurement as `summary()`.
- **Frontend**: `Dashboard.jsx` gained new KPI tile rows for every group-
  level metric above, a `NotBuiltKpi` component for the three honestly-
  unavailable tiles, alert banners (reusing the existing `.banner.error`/
  `.banner.info` CSS classes, no new component), a Company Performance
  Comparison table, and a `ChartCard` component drawing plain inline SVG
  bar charts for all four monthly series. No charting library was added —
  this frontend has deliberately kept dependencies to `react`/`react-dom`/
  `react-router-dom` throughout every earlier sprint, and four small bar
  charts didn't justify changing that. The Subsidiary Dashboard's
  per-company cards gained the matching financials/charts/outstanding-loans
  blocks (each conditionally rendered exactly when the API returns it —
  i.e., exactly when the viewing user is authorized for that company) and a
  labeled "Not Available for This Company" row for inventory/sales/
  procurement.

**A real bug was found and fixed during verification, not before it**: the
first cut of the new balance-position calculation omitted the synthetic
"Net Income (Current Period, Unposted)" equity line the existing Balance
Sheet report (Sprint 10) already adds — this system has no formal
period-close/retained-earnings-rollover process, so without that line,
total equity understates by exactly each company's net profit. That caused
a false "balance sheet does not balance" error alert to fire for **every**
company with posted revenue/expense activity — Morise Agro Ltd's reported
imbalance was exactly UGX 270,000, its own net profit for the period, to
the cent. Fixed by including the same synthetic line the real report already
uses; re-verified afterward with `totalAssets - (totalLiabilities +
totalEquity)` correctly at `0.00` for both seeded companies and the false
alert gone.

**Verified end-to-end** with a curl matrix: permission gating on all three
new endpoints (Finance Manager, scoped to Morise Agro Ltd only, correctly
receives `FORBIDDEN` calling group-wide `/dashboard/financials`); BR-01
scope isolation on the deepened company dashboard (the same Finance Manager
correctly receives `NOT_FOUND` requesting Morise Logistics Ltd's dashboard
by direct ID); authorized-users-only gating confirmed both ways (Finance
Manager's own company dashboard correctly includes `financials`/`charts`/
`outstandingLoans`; HR Manager — scoped to Morise Logistics Ltd, holds no
accounting or inter-company permission — correctly sees `financials` and
`outstandingLoans` as `null` on that same company's dashboard, not an
error); and manual arithmetic checks against the seeded chart of accounts
confirming the aggregated totals. A live browser/Playwright pass was not
available this session — no browser tool was available to the agent that
built this pass — so this is API-level verification only via curl, plus a
clean `vite build` (52 modules, zero errors) confirming the new frontend
code compiles; the same honest gap Sprint 9's update already recorded for
its own browser-pass-unavailable session.

**Deliberately not built**: Inventory Value, Sales Performance, and
Procurement Performance. No Inventory/warehouse, Sales/Invoicing, or
Procurement module exists anywhere in this codebase — all three are
deliberately deferred since Sprints 8/7/6 respectively, documented at
length earlier in this file. Rather than fake these tiles or quietly drop
them from the KPI list, every layer (API response, README, all 20 `docx`
documents) states plainly why they're empty. Building them for real means
building the underlying Sales/Procurement/Inventory modules first — the
same three-sprint gap this project has carried, and named honestly, since
Sprint 10's discovery pass.

## RBAC Completion — Full Role Catalogue Permissioned, Self-Service Password Change Added (19 August 2026)

This pass was requested directly against a full RBAC feature list: a User
Management bullet list (create/edit/activate-deactivate/reset password/
change password/lock accounts/manage profiles/assign companies-branches-
departments/assign roles/assign permissions/restrict access to modules,
companies, branches, financial information, and sensitive documents) and a
23-role catalogue (Super Administrator through Read-only User) — not a
numbered sprint or either of the two dashboard/company-holdings passes
immediately above it, from earlier the same day.

**The gap this pass found**: `04_Software Requirements Specification`,
Section 2.3's full 23-role catalogue was already seeded verbatim in
`prisma/seed.ts` (`ROLE_CATALOGUE`) since Sprint 1 — every role name in the
user's list already existed as a row in the `roles` table, upserted so
later sprints could assign it. But only 9 of those 23 roles
(`ROLE_PERMISSIONS`) had ever actually been given a permission: Super
Administrator, Managing Director, Group CEO, IT Administrator, Branch
Manager, Human Resources Manager, Finance Manager, Sales Manager,
Procurement Manager, and Auditor. The other 14 — Chief Financial Officer,
Accountant, Operations Manager, Project Manager, Inventory Manager,
Warehouse Manager, Legal Officer, Customer Service Officer, Employee,
External Auditor, Board Member, Investor, and Read-only User — existed as
rows a UI dropdown could select and an admin could assign to a user, but
granted that user precisely nothing: a user with any of those 14 roles and
no other grant could log in and then do nothing else. This is the same
"exists but is functionally inert" class of gap Sprint 2 found for company
management (a permission existed and was enforced correctly, but no seeded
user held it) — here the object holding nothing was the role definition
itself, not a demo user's assignment.

**What was built** — a reasoned permission set for each of the 14 empty
roles, mapped from the role's real-world job function onto the permission
catalogue that already exists (no new permission was needed for 12 of the
14 roles; see below), each with its reasoning recorded directly in
`prisma/seed.ts` next to the grant:

- **Chief Financial Officer**: mirrors Finance Manager's manage-level
  financial authority (`accounting.manage`, `asset.manage`,
  `asset.approve.disposal`, `expense.approve.finance`,
  `organization.intercompany.manage`) plus the Group-level oversight
  breadth Managing Director/Group CEO already hold for non-financial
  domains (`employee.viewAll`, `customer.viewAll`, `supplier.viewAll`,
  `product.viewAll`, `organization.company.viewAll`) — a financial
  executive senior to Finance Manager, not a peer.
- **Accountant**: `accounting.manage` and `expense.create` only —
  deliberately no approval-step or group-wide oversight permission,
  matching the seniority gap between "Accountant" and "Finance Manager" in
  a real finance department.
- **Operations Manager**: a generalist operational lead
  (`employee.manage`, `customer.viewAll`, `supplier.viewAll`,
  `product.manage`, `project.manage`, manager-step expense approval), the
  same breadth Sales Manager and Procurement Manager each already get for
  their own narrower domain.
- **Project Manager**: `project.manage`/`project.viewAll` plus manager-step
  expense approval — the actual hands-on project lead, distinct from
  Managing Director's `project.manage` (justified there, Sprint 12, as
  Group-level profitability oversight, not day-to-day project execution).
- **Inventory Manager** / **Warehouse Manager**: no Inventory module exists
  in this codebase (deliberately deferred since Sprint 8). Both roles are
  granted `product.manage`/`product.viewAll` as the closest existing
  analog (categories/units/barcodes) rather than left empty; Warehouse
  Manager additionally gets `asset.manage` (physical equipment custody is
  the closest thing this codebase actually models to a warehouse
  operation). Both should gain dedicated `inventory.*` permissions once
  that module is built — stated directly in the seed file, not left
  implicit.
- **Legal Officer**: read-only oversight only — `organization.company.viewAll`,
  `employee.viewAll` (contract terms), `supplier.viewAll` (contract
  references, FR-SUPP-02), `audit.view` — no create/manage permission
  anywhere, matching an advisory function rather than an operational one.
- **Customer Service Officer**: `customer.manage` (own scope only, BR-01),
  deliberately not `customer.viewAll` — no group-wide need for this role.
- **Employee**: `expense.create` only — the generic "regular staff member"
  floor. Every elevated capability in this system requires a specific role
  above this one; Employee is deliberately not a bundle of default access.
- **External Auditor**: mirrors Auditor's permission set exactly, rather
  than being independently re-derived — `04_Software Requirements
  Specification`, Section 2.3 itself groups "Auditor / External Auditor"
  on one line ("read-only access to audit trail and ledger"), treating them
  as one access level under two titles.
- **Board Member**: every `*.viewAll` permission across the business, zero
  create/manage/approve rights anywhere — deliberately narrower than Group
  CEO (an operating executive who also holds `expense.create`), since a
  Board Member's relationship to this system is oversight, not day-to-day
  operation.
- **Investor**: `organization.company.viewAll` and `accounting.viewAll`
  only — deliberately narrower than Board Member (no employee/customer/
  supplier/product/audit/asset/project visibility at all), matching an
  external stakeholder whose interest is financial performance, not
  operational detail.
- **Read-only User**: every `*.viewAll` permission, explicitly excluding
  `employee.view.sensitive` and `supplier.view.sensitive` — "read-only"
  should not imply seeing masked bank/tax fields unmasked; that stays a
  deliberately separate grant, matching how those two permissions already
  work everywhere else in this system.

**Self-service password change, a real endpoint gap, not a role gap**: the
User Management bullet list asked for "Reset passwords" and "Change
passwords" as two separate capabilities. This codebase already had two
password flows — `POST /identity/users/{id}/reset-password`
(admin-initiated, generates a temporary password, no current-password
check) and `POST /identity/auth/password-reset/confirm` (unauthenticated
forgot-password, token-based) — but no self-service "I'm logged in and want
to change my own password" flow at all; the My Profile screen's own text
told a user to sign out and use "Forgot Password?" instead, which is the
*reset* flow, not a *change* flow. Added `POST
/identity/users/me/change-password` (`ChangePasswordDto`:
`currentPassword` + `newPassword`, the latter validated by the same
`IsStrongPassword` validator FR-AUTH-04 already established): verifies the
caller's current password via `bcrypt.compare` before allowing the change,
revokes every other active refresh token the same way password-reset/
confirm already does (so a stolen session is invalidated by the legitimate
owner changing their password), and records `identity.user.password_changed`
to the audit trail. No new permission was needed — every authenticated
user may change their own password by construction; the current-password
check is the actual gate. A matching "Change Password" card was added to
the My Profile screen, replacing the old sign-out-and-use-forgot-password
hint text.

**A real audit gap was found and fixed in the same pass**: while adding the
new endpoint's audit call, the existing admin-initiated `resetPassword`
was found to never call `AuditService` at all — every other
password-affecting action (password-reset/confirm, lock/unlock, and the
new change-password above) was represented in the audit trail, but an
administrator resetting another user's password silently wasn't. Fixed,
recording `identity.user.password_reset` (never the temporary password
value itself, matching the no-sensitive-values-in-audit-payloads
convention already established for bank/tax fields elsewhere).

**"Restrict access to..." bullets — already implemented, verified rather
than rebuilt**: modules (every route is gated by `PermissionsGuard` +
`@RequirePermission`, enforced server-side per SEC-01, not just hidden
UI), companies and branches (`UserScope` + BR-01, enforced by
`isCompanyInScope()` on every scoped endpoint), and financial information
(`accounting.manage`/`accounting.viewAll`, the same gate FR-DASH-02's
Sprint 6 fix and this same day's Dashboard Deepening pass both already
rely on) were all already correctly implemented before this pass started —
re-verified, not rebuilt. **Restrict access to sensitive documents remains
an honest gap**: no document/file storage exists anywhere in this
codebase — Company logos are a plain URL string field, and every
Employee/Supplier/Asset "document reference" field is text, not an
uploaded file — the same deliberately deferred object-storage gap this
README has named at every point it came up (Company logos, Employee/
Supplier documents, Asset disposal documentation). There is nothing to
restrict access *to* yet; building real document storage is a
prerequisite this pass does not attempt, not a permission-design decision.

**Verified end-to-end** with a curl matrix: `GET /identity/roles` confirms
all 23 roles now carry the expected permission count (Super Administrator
28, the 14 previously-empty roles each carrying their new reasoned set,
e.g. Accountant 2, Board Member 12, Read-only User 12); a live test user
created and assigned only the new **Accountant** role correctly receives
`FORBIDDEN` calling `GET /identity/users` (no `identity.user.manage`) and
`GET /dashboard/summary` (no `organization.company.viewAll`); self-service
change-password correctly rejects a wrong current password with
`FORBIDDEN` and a clear message, correctly succeeds with the right one,
correctly revokes the old password (next login attempt with it fails) and
the new one works, and produces a matching audit entry; the admin
reset-password fix was verified the same way, producing its own new
`identity.user.password_reset` audit entry where none existed before. A
live browser/Playwright pass was not available this session (no browser
tool was available to the agent that built this pass) — API-level
verification only via curl, plus a clean `vite build` (52 modules, zero
errors) confirming the new Change Password card compiles; the same honest
gap Sprint 9's and this same day's Dashboard Deepening pass both already
recorded for their own browser-pass-unavailable sessions. The test user
created for verification was deactivated (not deleted — this codebase is
status-not-hard-delete by design, `schema.prisma`'s own header comment)
rather than left in the seeded demo data.

## HR Module Deepening — Recruitment, Attendance, Leave, Performance (19 August 2026)

This pass was requested directly against a full HR feature list opening
with "The HR module should manage employees across all companies," plus
five feature groups: Employee Management (mostly already built — see
below), Recruitment, Attendance, Leave Management, and Performance
Management — the last four entirely new modules, none of which existed
anywhere in this codebase before this pass. This is the largest single
pass in this project's history: four new NestJS modules, eleven new
database tables, two new columns on the existing `Employee` table, and
four new frontend screens.

**Migration**: `hr_module_recruitment_attendance_leave_performance`. New
tables: `employee_employment_history`, `job_vacancies`,
`job_applications`, `interviews`, `job_offers`, `shifts`,
`attendance_records`, `leave_balances`, `leave_applications`,
`performance_review_cycles`, `performance_objectives`,
`performance_reviews`. New `Employee` columns: `userId` (nullable,
unique — a logical link to an Identity Service `User`, the same
no-cross-service-FK convention every other reference in this schema
already uses) and `documentReference`, `shiftId`.

**Environment note, not a code bug**: applying this migration hit `P3005`
— the `_prisma_migrations` tracking table was missing from the dev
database even though every prior migration's tables were present and
populated (the dashboard/RBAC work from earlier the same day had run
successfully against this exact database). Resolved by baselining all 17
prior migrations with `prisma migrate resolve --applied <name>` (marks
them applied without re-running their SQL) before deploying the new one —
a one-time environment fix, not a schema or data change.

### Employee Management — re-verified, one real gap closed

Every bullet in the request's Employee Management list was already built
(Sprints 1-5): registration, profiles, identification, employee numbers,
job titles, departments/branches/companies, contract type, job
description, qualifications/skills/certifications (freeform), next of
kin, emergency contacts, bank/tax information (masked). Two gaps closed
this pass:

- **Employment history** was, since Sprint 3, one current position with a
  start/end date only — a documented simplification. This pass adds a
  real `EmployeeEmploymentHistory` table: `EmployeesService.update()` now
  closes the previous position into a history row (with a correctly
  computed `startDate` — the previous history row's `endDate` if one
  exists, not unconditionally `employmentStartDate`, which would have been
  wrong after a second position change) whenever `jobTitle`/
  `departmentId`/`branchId` actually changes. `GET
  /employees/{id}/employment-history` exposes it. Pre-existing employees'
  history is not backfilled — this codebase never captured that data.
- **Employee documents** — the request's own bullet — gets the same
  `documentReference` text-reference treatment already used for Company
  logos, Supplier contracts and Asset disposal documentation: a real
  field, not a fake one, but a reference string rather than an uploaded
  file, since no object storage exists in this proof-of-concept. Exposed
  on the Employees create form.

### Recruitment (entirely new)

`JobVacancy` (draft → pending_approval → open → closed, with
`recruitment.approve` as a genuine second-person gate mirroring
`asset.approve.disposal`'s "Management Approval" pattern) →
`JobApplication` (applied → shortlisted → interview_scheduled →
interviewed → offered → hired/rejected) → `Interview` (scheduling +
scoring combined into one entity, a 0-100 `score` field filled in once
`status = completed`) → `JobOffer` (pending → accepted/declined) →
**onboarding**, the funnel's actual end point: `POST
/recruitment/offers/{id}/onboard` creates a real `Employee` record from
the accepted offer (job title, branch/department and start date all
carried over from the vacancy/offer, not re-entered), closing Recruitment
into Employee Management rather than leaving "onboarding" as an unlinked
status flag. "Applicant database" is the applications list itself, not a
separate CRM table; "job advertisements" is a vacancy once `status =
open`; "CV management" is a `cvReference` text field — no public
candidate portal exists in this proof-of-concept, so applications are
entered by HR, not submitted directly by a candidate, and "CV management"
is the same text-reference pattern used everywhere else in this codebase
for documents.

### Attendance (entirely new)

`Shift` (one definition per company: start/end time, grace-period
minutes — not a full weekly-rota builder) + `AttendanceRecord`
(clock-in/out, one row per employee per day, `late`/`overtime` minutes
computed against the employee's assigned shift). Clock-in/out is
genuinely self-service — `POST /attendance/clock-in` and `/clock-out`
resolve the caller's own linked `Employee` via the new `userId` column,
no permission required beyond being logged in — or, with an explicit
`employeeId` and `attendance.manage`, recorded by HR/a manager on an
employee's behalf, since most seeded employees (and most real employees
in a system like this) have no login at all. "Attendance reports" is a
`GET /attendance/summary` aggregation (present/late/absent counts, total
overtime, per employee) — not yet wired through the CSV/PDF export
helper the Reports module already has; a natural, bounded piece of
follow-up work, not attempted here to keep this already-large pass from
growing further. Time comparisons use server-local time, the same
no-per-employee-timezone-modeling simplification this proof-of-concept
uses everywhere else a date/time is stored.

### Leave Management (entirely new)

Five leave types as a fixed enum (annual/sick/maternity/paternity/
emergency, matching the request's own fixed list — not a configurable
lookup table, the same judgment `AccountType`/`AssetStatus` already
apply). `LeaveBalance` (per employee/type/year; `usedDays` increments
only on approval, so a pending application never falsely reduces what's
still available) + `LeaveApplication` (submitted → approved/rejected/
cancelled, single-step approval — no source document names two leave
approval steps the way `05_Business Process Document` names two for
expenses, so the simpler, more common single-manager-approval pattern was
used). Approval enforces the balance in a transaction (insufficient
balance correctly returns `CONFLICT` with the exact shortfall, not a
silent overdraw). Submission is self-service by default (the caller's own
linked `Employee`) or, with `leave.manage`, on an employee's behalf.
Visibility without `leave.viewAll` is deliberately narrower than full
scope — your own applications plus ones awaiting your approval — the same
convention Expense claims already established (personal detail, not
shared master data). "Leave calendars" is a query view (approved leave
overlapping a date range for a company), not a stored entity.

### Performance Management (entirely new)

`PerformanceReviewCycle` (a bounded period, the same concept
`FinancialPeriod` already models for Accounting, applied here instead) →
`PerformanceObjective` (one entity for both "employee objectives" and
"KPIs" — the same underlying concept named two ways in the request, not
two separate tables; `targetValue` is deliberately freeform text rather
than forcing every KPI into one numeric shape) → `PerformanceReview`
(self_assessment_pending → manager_review_pending → completed, with
`promotionRecommended` and `trainingRecommendation` captured at
completion). Self-assessment submission and reading your own review both
check ownership (the caller's linked `Employee` matches `review.employeeId`)
**before**, not instead of, the usual scope-gated lookup — a real bug
caught during this pass, not before it (see below).

**A real bug was found and fixed during this pass, not before it**: the
first cut of `getReview`/`submitSelfAssessment` went straight through the
same `isCompanyInScope`-gated lookup every other Performance endpoint
uses. That's correct for HR/manager access, but wrong for an ordinary
"Employee"-role holder reading or submitting *their own* review — that
role holds no `organization.company.viewAll` and, per this project's own
seed data, may hold no `UserScope` at all, so the gate would have
incorrectly blocked a genuine self-service action with `NOT_FOUND`.
Fixed: both methods now check `review.employeeId` against the caller's
own linked `Employee` first, falling back to the scope-gated lookup only
for non-owners — the same self-service reasoning already applied to
Attendance's clock-in and Leave's submit, made consistent across the
third module that needed it.

**A real demo-reachability gap was found and fixed**: Human Resources
Manager is the only seeded role holding `recruitment.manage`/
`attendance.manage`/`leave.manage`/`performance.manage`, but Nakato (the
HR Manager persona) was scoped only to Morise Logistics Ltd — meaning no
seeded user could reach any of these four modules' "manage" actions for
Morise Agro Ltd's employees at all, the same "correct code, unreachable
through the demo" gap class Sprint 2 found for company management. Fixed
by adding a second `UserScope` (Morise Agro Ltd) to Nakato, not by
changing any permission — an HR Manager legitimately covering multiple
subsidiaries is exactly what this pass's own opening sentence describes.

**Permissions added** (eleven: `recruitment.manage`, `recruitment.approve`,
`recruitment.viewAll`, `attendance.manage`, `attendance.viewAll`,
`leave.manage`, `leave.approve`, `leave.viewAll`, `performance.manage`,
`performance.viewAll` — ten distinct codes, `leave.approve` counted once).
Human Resources Manager holds every `manage`/`viewAll` pair (HR owns this
module operationally); `leave.approve` was added to every role that
already held `expense.approve.manager` (Branch Manager, Sales Manager,
Procurement Manager, Operations Manager, Project Manager, Inventory
Manager, Warehouse Manager — the same line-manager-approval reasoning
extended from expenses to leave); Managing Director holds
`recruitment.approve` (mirroring `asset.approve.disposal`'s "Management
Approval" reasoning) plus Group-level `viewAll` breadth; Group CEO, Chief
Financial Officer, Auditor, External Auditor, Board Member and Read-only
User each gained the four new `viewAll` permissions, matching how each
role already picked up every other module's `viewAll` grant; Investor
deliberately did not (its own established rationale — strictly financial
visibility, no operational detail — extends cleanly to HR).

**Seed data**: Kintu (Branch Manager, an existing login) linked to a new
`Employee` record — the only way any self-service Attendance/Leave/
Performance action is reachable through the demo at all, the same
reused-persona-over-new-login approach this project has used consistently
since Sprint 9. A `Day Shift` (08:00-17:00, 15-minute grace) assigned to
Kintu, Grace and David. 2026 leave balances (21/10/90/4/5 days —
annual/sick/maternity/paternity/emergency) for all three, with one
submitted and one already-approved application (the latter's balance
correctly pre-deducted). One vacancy (`Field Agronomist`) carried through
the **entire** funnel for one candidate — applied → shortlisted →
interviewed (scored 82) → offered → accepted → **onboarded into a real
Employee record** — plus a second application still early in the pipeline
as a live target for "Shortlist"/"Reject." One review cycle (`2026 H2
Review`) with three reviews at three different lifecycle stages, the same
"three stages at once" seeding pattern Sprint 11 established for assets.

**Verified end-to-end** with a curl matrix: self-service clock-in/out for
Kintu (correct `late`/`overtime` computation against his assigned shift,
`CONFLICT` on a second same-day clock-in); leave approval correctly
deducting the balance and correctly blocking re-approval of an
already-approved application; the full recruitment funnel walked live
through the real API (shortlist → interview → complete → offer →
respond → onboard), confirming the onboarded record's `jobTitle`/
`employmentStartDate` came from the vacancy/offer and that re-onboarding
the same offer correctly returns `CONFLICT`; self-assessment and manager
assessment both permission- and ownership-gated correctly (Kintu, who has
no `performance.manage`, correctly receives `FORBIDDEN` submitting a
manager assessment despite being the named manager on the review); and
BR-01 scope isolation confirmed on the new endpoints (Sales Manager,
scoped only to Morise Agro Ltd, requesting Morise Logistics Ltd's
attendance records by direct `filter[companyId]` correctly falls back to
her own scope's data instead, the same Sprint 8 fix this project already
established). A live browser/Playwright pass was not available this
session — API-level verification only via curl, plus a clean `vite build`
(56 modules, zero errors) confirming all four new frontend screens
compile — the same honest gap every prior pass this same day has already
recorded.

**Deliberately not built / honestly deferred**: a public candidate portal
for Recruitment (applications are HR-entered); real file upload for CVs/
employee documents (the same object-storage gap this README has named at
every point it came up); a full weekly-rota/shift-scheduling system for
Attendance (one shift definition per company, not per-day schedules);
per-employee timezone modeling; `attendance/summary` wired through the
CSV/PDF export helper; and backfilled employment history for employees
who existed before this pass. None of these were silently dropped — each
is named here and, where relevant, in the code comment for the exact
simplification it stands in for.

## Financial Module Deepening — General Ledger, Accounts Receivable, Accounts Payable, Financial Statements (19 August 2026)

This pass was requested directly against a full Financial Module feature
list: General Ledger gaps (account reconciliation, adjusting entries,
closing entries), Accounts Receivable, Accounts Payable, and five new
Financial Statements (Cash Flow Statement, Statement of Changes in Equity,
Budget vs Actual, Financial Ratios, Management Accounts) — not a numbered
sprint or any of the three passes earlier the same day.

**A real duplication was found and corrected before any service code was
written, not after**: this pass's first draft of Accounts Receivable
defined its own `CustomerInvoice`/`CustomerInvoiceItem`/`CustomerPayment`/
`CustomerPaymentApplication` models and generated a migration creating
them. Before writing the service layer, a routine check of the live
database (`\dt`) turned up `invoices`, `orders`, `order_items`, `payments`,
`payment_allocations`, `delivery_addresses` and `customer_refresh_tokens` —
a complete, already-working Order → Invoice → Payment/PaymentAllocation
system with a real customer login portal, built **concurrently by a
different session** while this pass was running (visible in this
codebase as `src/sales/`, `src/customer-portal/`, and the "Customer
Storefront" section of `schema.prisma`). The four draft models would have
been a second, competing invoicing concept for the exact same domain.
They were deleted — along with the migration that had already created
their tables — before any AR service code referenced them, and a
follow-up migration dropped those tables and added the columns the
surviving Credit/Debit note models needed. AR was then rebuilt against
the real `Invoice`/`Payment`/`PaymentAllocation`/`Order` models instead,
adding only what was genuinely missing there (see below). This is worth
recording plainly: this project has had two independently-working
sessions modifying the same live dev database and the same `schema.prisma`
concurrently since at least the HR Module Deepening pass earlier the same
day (`Orders.jsx`/`SupportTickets.jsx` first appeared in the frontend
between passes, unexplained by anything in this session's own work) — the
`_prisma_migrations` tracking table has gone missing and needed
re-baselining three separate times across these last two passes, almost
certainly from two Prisma CLI processes racing against the same database.
Every migration in this pass was re-verified against the live schema
after applying, specifically because of this risk.

### General Ledger: three long-standing gaps closed

- **Closing entries**: `FinancialPeriodsService.close()` now accepts an
  optional `retainedEarningsAccountId`. When given, it generates and posts
  a real closing journal entry — before marking the period closed, since
  posting after would trip BR-04's own guard — debiting each revenue
  account by its credit balance and crediting each expense account by its
  debit balance (zeroing both), with the net difference (profit credited,
  loss debited) to Retained Earnings, tagged `entryType: closing`. This
  closes a gap this README has flagged at every point it came up since
  Sprint 10: the Balance Sheet report and the Dashboard's financials block
  have both carried a synthetic "Net Income (Current Period, Unposted)"
  equity line as a workaround, precisely because no closing process
  existed to roll net income into equity for real. Verified end-to-end on
  a throwaway test period: a 100,000 revenue entry posted, then closed
  with a Retained Earnings account — the generated closing entry correctly
  debited the revenue account 100,000 and credited Retained Earnings
  100,000, balanced by construction.
- **Adjusting entries**: `JournalEntry` gained an `entryType` column
  (`standard`/`adjusting`/`closing`). `POST /accounting/journal-entries`
  accepts an optional `entryType: 'adjusting'` — a classification tag for
  period-end accruals/prepayments/depreciation catch-ups entered manually,
  not a different posting mechanism.
- **Account reconciliation**: a new `AccountReconciliation`
  model/endpoint — ties one account's ledger balance, as of a date, to an
  external statement balance (most commonly a bank statement), recording
  the variance and a reconciled/open status. Distinct from the trial
  balance's balanced/unbalanced flag, which only proves debits=credits
  system-wide, not that any one account matches reality outside the
  system. Seeded and verified with a realistic small variance (an
  unrecorded UGX 15,000 bank charge) on the Cash and Bank account.

### Accounts Receivable — built on the real Invoice/Payment system, not a competing one

Only what was genuinely missing on top of the Sales module's own Invoice/
Payment/PaymentAllocation/Order models: `CustomerCreditNote` and
`CustomerDebitNote` (both post a real journal entry against the company's
`accountSubType: receivable` account), a **staff-facing** aging report and
statement view (the existing `InvoicesService.statementForCustomer` only
lets a logged-in customer see their own data — Finance/AR staff had no
way to see any customer's statement, or an aging view across all
customers, at all), and payment reminders. "Payment reminders" records an
audit-trail event (`ar.invoice.reminder_sent`) rather than adding a
dedicated table — no email/SMS delivery infrastructure exists in this
proof-of-concept (the same deferred-notification gap named throughout
this project for real external delivery), so a reminder is a recorded
action, not a sent message, the same honest distinction Recruitment's
"applications are HR-entered, not candidate-submitted" already makes. No
new permission was added — AR reuses `accounting.manage`/
`accounting.viewAll`, since credit/debit notes and financial statements
are inherently accounting/finance actions.

### Accounts Payable — an entirely new domain

No purchase/procurement/supplier-invoice tables existed anywhere in this
codebase before this pass (confirmed via the same live-database check that
caught the AR duplication above) — `SupplierInvoice` (+ line items),
`SupplierPayment` (+ `SupplierPaymentApplication`, supporting partial
payments and a payment covering multiple invoices, the same shape
`PaymentAllocation` already uses on the AR side), and `SupplierCreditNote`
are genuinely new. A real approval workflow: draft → pending_approval →
approved (posts the invoice's journal entry: debit expense/asset, credit
AP) → partially_paid/paid (each payment posts debit AP, credit bank).
Three new permissions (`ap.manage`, `ap.approve`, `ap.viewAll`) — `ap.approve`
was given to Managing Director and Chief Financial Officer, mirroring the
exact "Management Approval" reasoning `asset.approve.disposal` (Sprint 11)
and `recruitment.approve` (HR Module Deepening) already established for
this role; `ap.manage` went to Finance Manager, Chief Financial Officer,
and Procurement Manager (the last one specifically because they "receive
the goods/services and enter the invoice," the same reasoning that already
gave Procurement `asset.manage`, Sprint 11). Aging report, supplier
statement, and payment schedule (outstanding bills sorted by due date, a
query view like Leave's calendar and AR's aging, not a stored entity) round
out the AP bullet list.

### Financial Statements

Four new report endpoints on the existing Accounting Reports controller,
reusing its own `aggregateAccountBalances`/`buildConsolidated` helpers and,
for Management Accounts, its own `incomeStatement`/`balanceSheet` methods
called directly rather than re-fetched over HTTP:

- **Cash Flow Statement**: a real, three-section (operating/investing/
  financing) statement — direct method, summing net movement through
  `cash`/`bank`-subtype accounts for posted entries in a period, bucketed
  by the OTHER account each journal entry also touches. Explicitly a
  simplified categorization (inferred from account type/subtype at read
  time, not a rigorous IAS-7 classification — no formal current/
  non-current tagging exists anywhere in this chart of accounts), and
  distinct from the Dashboard's own "cash flow chart" (a single net-number
  per month, already documented there as not a full statement) — this is
  the full statement that chart deferred building.
- **Statement of Changes in Equity**: opening balance (equity to the day
  before the period starts) + net income for the period + other movements
  (a residual capturing any direct equity postings that aren't
  revenue/expense) = closing balance. Verified: a direct capital-injection-
  style entry from seed data correctly showed up in "other movements," not
  silently absorbed into net income.
- **Financial Ratios**: net profit margin, ROA, ROE, debt-to-equity, asset
  turnover — all computed correctly from existing report data. Current
  ratio and quick ratio are **deliberately not computed** and say so in the
  response (`not_computed`/`not_computed_reason`) — no current-vs-non-current
  account classification exists in this chart of accounts, and faking one
  by treating all assets as "current" would produce a silently wrong
  number, not a simplified right one, unlike every other simplification in
  this pass.
- **Budget vs Actual**: a new lightweight `Budget` model (one budgeted
  amount per account per financial period, distinct from `Project.budget`'s
  single lump-sum figure) compared against actual posted activity.
- **Management Accounts**: not a new financial concept — a single bundle
  of the Income Statement, Balance Sheet, Financial Ratios and Budget vs
  Actual for one period, assembled from the same real report methods
  every other endpoint here already computes.

**Verified end-to-end** with a curl matrix: the AP approval workflow
walked live (a Finance Manager holding only `ap.manage` correctly receives
`FORBIDDEN` approving an invoice; Managing Director, holding `ap.approve`,
succeeds; the trial balance stays balanced immediately after); AP aging
correctly excludes a `pending_approval` invoice and correctly buckets a
`partially_paid` one; Budget vs Actual correctly summed two supplier
invoices against one COGS account budget (UGX 700,000 budgeted vs
2,100,000 actual, a 200% unfavorable variance); the closing-entry
generation test described above; and AR aging/reconciliation both
returned correct figures against seeded data. A live browser/Playwright
pass was not available this session — API-level verification only via
curl, plus a clean `vite build` (59 modules, zero errors) confirming the
new Accounts Payable screen compiles.

**Deliberately not built this pass**: a frontend screen for Accounts
Receivable's new staff-facing views (aging/statement/credit-debit notes)
and for the five new Financial Statements (Cash Flow, SOCE, Ratios,
Budget vs Actual, Management Accounts, Reconciliation) — all verified and
working at the API level, none yet has a UI. Given the scale of this pass
(on top of three other full passes the same day), Accounts Payable was
judged the higher-value screen to build first, since it was the only one
of the two subledgers with zero pre-existing UI of any kind; AR's
customer-facing side already has a working portal, and its new
staff-facing views are a natural next screen, not attempted here to keep
this already-large pass bounded.

## Judgment calls made against the source documents

1. **Stack**: `Multi_Holdings_Limited_Software_Development_Procedures.docx`
   contradicts itself — Section 7 specifies Node.js/NestJS/Fastify/
   PostgreSQL/Prisma, but Section 10 lists PHP/Laravel/MySQL instead (reads
   like unedited template boilerplate). Went with Node/NestJS/Postgres/Prisma
   since that's the one `morise.docx`, `07_System Design Document`, and
   `18_UI-UX Design` all agree on.
2. **Microservices**: the Group's document set records a formal decision
   (`07_System Design Document` v2.0, ADR-02/03/04/05) to build Phase 1 as a
   full microservices architecture — eight independently deployable
   services plus an API Gateway, Kafka event streaming, a database-per-
   service pattern, and a full observability stack — specifically
   superseding an earlier modular-monolith recommendation
   (`03_Feasibility Study`, Section 3.1.1). **This proof-of-concept
   implements that earlier, superseded monolith approach, not the currently
   approved one**: every service runs as a module of one NestJS application
   against one PostgreSQL database — no API Gateway, no Kafka, no
   per-service databases, no observability stack. It validates the business
   logic and data model end-to-end quickly; decomposing it into true
   independent services remains substantial, unstarted work.
   **The Audit Trail specifically**: the approved architecture populates
   `audit_logs` exclusively by an Audit & Reporting Service consuming Kafka
   domain events every other service publishes (`09_API Specification`,
   Section 11). With no Kafka in this slice, each service instead calls a
   shared, `@Global()` `AuditService.record()` directly and synchronously —
   functionally equivalent (the same event shape lands in the same table),
   but a synchronous in-process call standing in for what should be an
   async publish/consume pair. `access_denied` events are the one case
   handled centrally rather than per-service: `PermissionsGuard` records
   them itself on every FORBIDDEN response, since every permission check
   already passes through that one guard regardless of which module it
   protects — the closest thing to "gateway-level" behavior this
   monolith has. Regular create/update/approve events are recorded from a
   representative subset of mutations (at least one per service, matching
   `10_Test Plan` TC-023's literal intent — "perform one create/edit/delete
   action in each service"), not literally every single write endpoint
   across ~50 built so far; extending coverage to every remaining mutation
   is mechanical follow-up work, not a design gap. IP address capture is
   wired only where the request object was already available
   (`PermissionsGuard`'s `access_denied` events); threading it through
   every individual mutating service call was judged disproportionate
   effort for a proof-of-concept, especially since request-level metadata
   like this is conceptually the API Gateway's concern in the approved
   architecture anyway.
3. **API paths and response envelope** follow `09_API Specification`
   exactly (`/api/v1/identity/...`, `/api/v1/organization/...`,
   `/api/v1/employees/...`, `/api/v1/customers/...`, `/api/v1/suppliers/...`,
   `/api/v1/products/...`, `/api/v1/product-categories/...`,
   `/api/v1/accounting/...`, `/api/v1/dashboard/...`, `/api/v1/audit/logs`,
   the `{data, error}` / `{data, meta, error}` shapes, and the
   VALIDATION_ERROR/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/
   UNBALANCED_ENTRY/PERIOD_CLOSED/RATE_LIMITED codes).
4. A resource outside the caller's scope returns `404 NOT_FOUND`, not `403`,
   per the API spec's own stated reasoning: the response shouldn't confirm
   the resource even exists.
5. **Permission model**: each service defines its own "group-wide
   visibility" permission (`organization.company.viewAll`,
   `employee.viewAll`, `customer.viewAll`, `supplier.viewAll`,
   `product.viewAll`, `accounting.viewAll`) rather than one shared flag — a role can have
   Group-wide company visibility without also having Group-wide financial
   visibility. A single "manage" permission per service (`accounting.manage`,
   `customer.manage`, `supplier.manage`) covers all write actions for that
   service rather than a finer per-action split, since only one demo role
   per service exists in this slice. Matching `09_API Specification`
   precisely, list/get endpoints for Customers and Suppliers require only a
   valid scope ("Bearer + scoped") — any authenticated user in the right
   company can view them — while create/edit/blacklist require the specific
   "Sales/admin" or "Procurement/admin" permission; this is a deliberately
   looser gate than Employees' list endpoint, which requires
   `employee.manage`/`employee.viewAll` even to view, matching that
   service's own "Bearer + HR/admin" spec instead.
6. **Audit Trail scope**: `GET /audit/logs` applies no company-scope
   filtering — any `audit.view` holder sees every company's events, not
   just their own. Every other list endpoint in this codebase is
   scope-restricted per BR-01; the audit trail deliberately isn't, on the
   reasoning that an Auditor role (SRS Section 2.3: "read-only access to
   audit trail and ledger") needs cross-company visibility to do its job.
   This is a judgment call, not something the source documents settle
   explicitly, so it's called out here rather than left silent.
7. **Expense approval separation of duties, Sprint 9**: nothing server-side
   stops a user who holds both `expense.create` and `expense.approve.manager`
   (e.g. Branch Manager) from approving their own submitted claim — there is
   no submitter-!=-approver check anywhere in `ExpensesService`. The frontend
   doesn't build an "approve your own claim" affordance, but the API itself
   has no guard against it. `05_Business Process Document` and `morise.docx`
   describe the *stages* of the workflow (manager approval, then finance
   approval) but never say a claim's own submitter must be excluded from
   approving it — left as an open question for the Board rather than
   guessed at, the same way Sprint 1's password policy and Sprint 2's
   ownership-percent fields were added only once a source document actually
   specified them.
8. **Expense/Accounting coupling, Sprint 9**: `pay()` writes directly into
   the Accounting module's `JournalEntry`/`JournalEntryItem` tables via a
   same-process Prisma call, not through a real API call or Kafka event —
   the tightest coupling between two "services" anywhere in this monolith.
   Every earlier module either owns its data outright or references another
   module's ID logically (no FK); Expenses does that for its own scope
   fields but takes a real, enforced foreign key onto `accounts.id` and
   writes real rows into `journal_entries`/`journal_entry_items`. Correct
   for a proof-of-concept sharing one database, but a genuine independent
   Expense Service under the approved microservices architecture would need
   to either own its own ledger-posting logic or call Accounting through a
   real API/event — this shortcut doesn't survive that decomposition
   unchanged, worth flagging explicitly rather than leaving implicit.
9. **Which documents got updated, Sprint 9**: "update all the documents"
   was read as the maintained SDLC document set this project already
   revises sprint over sprint — all eighteen numbered `docx/` documents plus
   `Multi_Holdings_Limited_Software_Development_Procedures.docx` and
   `morise.docx`, all twenty of which already carried thirteen prior
   "Implementation Status Update" entries each before this sprint, now
   fourteen. `docx/Board Resolution for Morise Holdings Limited(2).odt`,
   `docx/implementation_requirements.odt` and `docx/needed_documents.odt`
   were left untouched — they're source/reference material this project has
   never revised in any earlier sprint (no prior update log exists in any of
   them), and `.odt` isn't a format `python-docx` can write to safely.
10. **Which sprint-numbering scheme to trust, Sprint 10**: this document
    set now demonstrably contains two independent, non-identical sprint
    numbering schemes — `17_Development Plan`'s own Sprint 0–8 (Phase 1
    only, dependency-ordered) and
    `Multi_Holdings_Limited_Software_Development_Procedures.docx`'s Sprint
    1–14 (all phases, the one every actual request has matched — see
    "Sprint 10," above). Going forward, a request naming "Sprint N" should
    be checked against **both** before concluding it's a mismatch requiring
    a redirect — Sprint 10's own discovery only happened because this
    check was finally run against the second document, five sprints later
    than it could have been.
11. **Balance sheet's synthetic equity line, Sprint 10**: "Net Income
    (Current Period, Unposted)" is computed on the fly from revenue/expense
    activity, not a real ledger account — no source document describes a
    formal period-close-to-retained-earnings process for this system, so
    one wasn't invented. Without this line the balance sheet simply
    wouldn't balance for any company with unclosed revenue/expense
    activity; documented rather than silently patched over.
12. **Disposal gain/loss account not type-validated, Sprint 11**: `dispose()`
    accepts any account for `gainLossAccountId` and simply credits it for a
    gain or debits it for a loss — it does not check that a caller-chosen
    "gain" account is actually revenue-typed or a "loss" account
    expense-typed. Found during this sprint's own verification (a revenue
    account was passed for what was actually a loss, and it posted anyway,
    correctly balanced but poor bookkeeping hygiene). Left permissive by
    design, matching how manual journal entries already trust the caller's
    account choices; mitigated at the UI layer instead, where the Dispose
    modal now computes and displays the gain/loss live before submission.
13. **Project team membership is hard-deleted, Sprint 12**: `removeTeamMember()`
    calls `deleteMany()` — the only hard delete anywhere in this codebase
    outside a join table's `onDelete: Cascade`. Every other business entity
    in this system follows the status-not-hard-delete convention
    `schema.prisma`'s own header comment states; a project team assignment
    was judged to be a join/assignment record with no standalone history
    value, the same class as `RolePermission`/`UserRole`, which already
    cascade-delete rather than soft-delete. Worth flagging explicitly since
    it's a real exception to a convention stated as universal elsewhere,
    not an oversight.
14. **No new "Project Manager" persona, Sprint 12**: `project.manage` was
    granted only to already-seeded demo roles (Super Administrator,
    Managing Director, Finance Manager) even though "Project Manager" is
    a role the catalogue already lists (`06_User Stories`' role list) and
    the most obviously-named fit. Adding a ninth demo login was judged
    higher-risk than reusing existing personas for a single sprint's scope,
    the same minimal-footprint choice made throughout every earlier sprint.
15. **Reports enforce each source module's own permission, not a new one,
    Sprint 13**: no generic `report.view` permission was created. Each of
    the six report endpoints requires exactly what its underlying data
    already requires elsewhere (`organization.company.viewAll` for
    companies, `employee.manage`/`employee.viewAll` for employees,
    `audit.view` for the audit trail, scope-only for customers/suppliers/
    accounting) — checked against each source controller's actual
    `@RequirePermission` decorator before writing the report route, not
    assumed. A single shared "can view reports" permission would have been
    simpler to grant but would have been a real access-control regression:
    it would let a role that can't see, say, the audit trail through the
    normal screen see it anyway through a report export.
16. **First new runtime dependency of this project, Sprint 13**: `pdfkit`
    was added to `package.json` for RPT-06's PDF export — every capability
    before this sprint was built from what was already installed. CSV
    export needed no dependency (a plain string writer); real PDF
    generation did.
17. **Notification coverage is a demonstrated pattern, not exhaustive,
    Sprint 14**: only expense approval and asset disposal trigger
    notifications. Recurring journal entry generation, project milestone
    due dates, and every other approval-gated action in this system do
    not, yet. This mirrors the same "representative subset of mutations"
    honesty this project has applied to Audit Trail coverage since Sprint
    1 — the mechanism (`NotificationsService.notifyUsers()` +
    `findUsersWithPermissionInCompany()`) generalizes trivially to any
    other trigger point; wiring it in everywhere was judged out of scope
    for demonstrating the pattern works correctly.
18. **`findUsersWithPermissionInCompany()` resolves across the whole user
    table, not one caller's session, Sprint 14**: unlike every other scope
    check in this codebase (which narrows an already-authenticated
    caller's own `permissions`/`scopes`), this helper answers "which users,
    plural, should be notified" — it has to walk every active user's
    roles/permissions/scopes to answer that, which no existing utility in
    `common/scope.util.ts` was built to do. A new function, not a reuse of
    `isCompanyInScope`, was the correct call here, even though the two
    checks are conceptually related.
19. **Inter-company permissions are group-wide only, by design, Company/
    Holdings pass**: `organization.intercompany.manage`/`.viewAll` have no
    scoped/per-company variant, unlike every other "manage"/"viewAll" pair
    in this codebase. A transaction inherently touches two companies at
    once, so a permission scoped to one company can't correctly gate it —
    the group-wide design was deliberate, but it was only actually
    *enforced* after this pass found `create()`/`post()`/`get()` missing
    the checks that make that design real rather than accidental (see the
    section above).
20. **Asset cross-company transfer clears GL account links rather than
    remapping them, Company/Holdings pass**: `transfer()` sets
    `assetAccountId`/`depreciationExpenseAccountId`/
    `accumulatedDepreciationAccountId` to `null` when `toCompanyId` differs
    from the asset's current company, rather than attempting to find an
    equivalent account in the destination company's chart of accounts. No
    source document specifies an account-mapping strategy across companies,
    and guessing one (e.g. matching by account code) risks silently posting
    future depreciation to the wrong company's ledger if the guess is
    wrong — clearing the links forces a human to re-link them via the
    existing asset-edit flow before the next depreciation run, a safer
    failure mode than a wrong guess.
21. **No demo persona proves the full cross-company asset-transfer success
    path, Company/Holdings pass**: see "A gap noted, not fixed" above —
    left as-is rather than adding a ninth demo login, the same
    minimal-footprint call Sprint 12 made for Project Manager.

## Prerequisites

- Node.js 20+, Docker

## Running it

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate dev --name init   # already run once during setup
npx ts-node prisma/seed.ts           # seeds roles, demo companies, demo users, starter data
npm run start:dev                    # http://localhost:3001/api/v1
                                     # Swagger UI at http://localhost:3001/api/v1/docs

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

If you change the Prisma schema and see `Cannot find module '.../dist/main.js'`
or a similarly stale-looking build, delete `backend/tsconfig.tsbuildinfo` and
`backend/dist` before rebuilding — TypeScript's incremental build cache can
get out of sync with a manually-deleted `dist/`. For the same reason, run
`rm -f tsconfig.tsbuildinfo` before `npm run build` if a build produces no
`dist/main.js` yet reports success.

`backend/.env`'s `PASSWORD_MIN_LENGTH` (default `8`) is the configurable half
of FR-AUTH-04's password policy; complexity (uppercase + lowercase + digit)
is fixed, not configurable.

## OpenAPI / Swagger API documentation

The backend generates its own OpenAPI 3 contract from the code — it is not
hand-maintained. `09_API Specification` remains the prose reference; this is
its machine-readable, always-current companion.

| What | Where |
|---|---|
| Swagger UI (interactive "Try it out") | `GET /api/v1/docs` |
| Raw OpenAPI 3 document | `GET /api/v1/docs-json` |
| Committed snapshot | `backend/openapi.json` |

- **How it's wired:** `@nestjs/swagger` in `src/main.ts`, with its CLI plugin
  enabled in `nest-cli.json`. The plugin reads the existing `class-validator`
  DTOs, so request/response schemas are populated without `@ApiProperty`
  decorators (245 paths / 309 operations / 116 schemas at time of writing).
- **Auth:** two bearer schemes, `staff` and `customer`, matching the two JWT
  audiences in `.env` (`JWT_ACCESS_SECRET` / `JWT_CUSTOMER_ACCESS_SECRET`).
  In the UI, click **Authorize**, paste an access token from
  `POST /api/v1/identity/auth/login` (staff) or
  `POST /api/v1/customer-portal/auth/login` (customer). The choice persists
  across reloads.
- **Build requirement:** the Swagger CLI plugin only runs through
  `nest build` / `nest start`, **not** a bare `tsc`. Build the backend with
  `npm run build` (after `rm -f tsconfig.tsbuildinfo`); a raw `tsc` build
  yields endpoints with empty schemas.
- **Refresh the snapshot:** with the server running, `npm run openapi:generate`
  writes `backend/openapi.json` from `/api/v1/docs-json`
  (`scripts/generate-openapi.ts`).
- **Dependencies added:** `@nestjs/swagger`, and `@fastify/static` (the
  Fastify adapter serves the Swagger UI assets through it).

## Demo accounts (seeded, local dev only)

| Email | Role | Scope |
|---|---|---|
| m.okurut@morise-holdings.com | Managing Director | Group-wide |
| g.obeke@morise-holdings.com | IT Administrator | Group-wide |
| p.kintu@morise-holdings.com | Branch Manager | Morise Agro Ltd only |
| m.nakato@morise-holdings.com | HR Manager | Morise Logistics Ltd only |
| a.smith@morise-holdings.com | Finance Manager | Morise Agro Ltd only |
| s.namuli@morise-holdings.com | Sales Manager | Morise Agro Ltd only |
| r.kato@morise-holdings.com | Procurement Manager | Morise Agro Ltd only |
| s.nassuna@morise-holdings.com | Auditor | Read-only, group-wide |

Password for all: `Passw0rd!23`

Try logging in as `p.kintu@...` and opening **Companies** — the group-wide
list is forbidden (no `organization.company.viewAll` permission), and
opening Morise Holdings Limited directly by URL returns "not found" (out of
scope), while Morise Agro Ltd opens normally. That's BR-01 (scope-aware
access) enforced by the API, not the UI. Log in as `m.nakato@...` and open
**Employees** to see the same scoping applied to a different service (empty
list — no employees exist yet in her scoped company, Morise Logistics Ltd).
Log in as `a.smith@...`, open **Accounting → Journal Entries**, and try
posting an entry with mismatched debit/credit line items to see
`UNBALANCED_ENTRY` returned exactly as `09_API Specification`, Section 9.1
documents it. Log in as `r.kato@...` and open **Suppliers** to blacklist/
unblacklist AgroChem Uganda Ltd or Zenith Traders (seeded already
blacklisted); log in as `s.namuli@...` and open a customer in **Customers**
to see the credit-limit/payment-terms edit form and the honestly-empty
statement panel. Either `r.kato@...` or `s.namuli@...` can open **Products**
and create a product with a brand-new category inline — both roles hold
`product.manage`, matching `09_API Specification`'s "Bearer + Procurement/
Sales/admin" requirement for that endpoint. Log in as `s.nassuna@...` and
open **Audit Trail** to see every action above logged with who/what/when —
including her own attempts to view a module she doesn't have permission
for, captured as `access_denied` events. As `m.okurut@...` (or any
Group-level role), the **Dashboard**'s new Recent Activity panel shows the
same feed live.

**Expenses (Sprint 9)**: log in as `p.kintu@...` and open **Expenses** — his
own "Travel" claim is already seeded (`submitted`), and he can submit a new
one against Morise Agro Ltd's chart of accounts. Log in as `s.namuli@...` or
`r.kato@...` (both hold `expense.approve.manager`) to see and manager-approve
Kintu's claim — a manager can't approve their own claim through this UI, but
nothing server-side stops a user who holds both `expense.create` and
`expense.approve.manager` from doing so directly against the API, a known
gap (see "Judgment calls" below). Log in as `a.smith@...` (Finance Manager)
and open **Expenses** to see the seeded "Office Supplies" claim awaiting her
finance approval, and a third, already-`paid` claim — approve the pending
one, then use **Pay & Post** to post it to the ledger and confirm the new
balanced journal entry on the **Accounting → Journal Entries** tab.

**Full Accounting (Sprint 10)**: log in as `a.smith@...` (Finance Manager,
Morise Agro Ltd) and open **Accounting → Recurring Entries** — a seeded
"Monthly Office Rent" template is ready to **Generate…** into `FY2026-Q1`,
producing a new draft entry visible on the **Journal Entries** tab, which
still needs a separate **Post** click (recurring templates don't
auto-post). Open **Income Statement** or **Balance Sheet** for Morise Agro
Ltd to see real seeded revenue/expense/asset figures — the Balance Sheet's
`Balanced` badge should read green. Log in as `m.okurut@...` (Managing
Director, Group-wide), open **Accounting**, select **Morise Holdings
Limited** as the company, tick **Consolidated** on either report, and
generate — Morise Agro Ltd and Morise Logistics Ltd both roll up into one
combined total, with the holding company itself listed under "Excluded"
(it has no financial period of its own, correctly).

**Asset Management (Sprint 11)**: log in as `r.kato@...` (Procurement
Manager, Morise Agro Ltd) and open **Assets** — a fresh "Toyota Hilux
Pickup" is ready for **Record Depreciation** (try posting more than
40,000,000 to see the depreciable-cost guard reject it with `CONFLICT`),
and a "Dell Latitude Laptop" already sits at "disposal requested." Log in
as `m.okurut@...` (Managing Director) to **Approve Disposal** with
inspection notes — Kato himself cannot approve his own request, since he
lacks `asset.approve.disposal`. Log in as `a.smith@...` (Finance Manager)
to **Dispose** it: the modal shows the computed gain/loss live before you
pick an account, then posts a balanced four-line derecognition entry,
visible afterward on the **Accounting → Journal Entries** tab. A third
asset, "Office Printer - HP LaserJet," is already fully `disposed`,
showing the complete lifecycle at a glance.

**Project Management (Sprint 12)**: log in as `a.smith@...` (Finance
Manager, Morise Agro Ltd) and open **Projects** — "Warehouse Expansion —
Kira HQ" is `active` with a two-person team, one done and one in-progress
task, and a pending milestone; open **Details** to mark the remaining task
done, complete the milestone, or walk it through **Put On Hold** →
**Resume** → **Mark Complete** → **Close Project**. Open "Agro Export
Contract — Kenya," already `closed`, to see its **Profitability** panel —
a real `paid` expense claim was attributed to this project via its
optional project link, so Actual Cost, Margin and Margin % are all
computed from real data, not placeholders.

**Reports (Sprint 13)**: log in as `m.okurut@...` (Managing Director,
Group-wide) and open **Reports** — pick "Companies & Branches" and
**Generate** to see every subsidiary and branch on screen, or **Export
CSV**/**Export PDF** to download the file directly (the PDF is a real,
valid document, confirmed with the `file` command during this sprint's own
verification — not just a 200 response). Log in as `a.smith@...` (Finance
Manager) and pick "Chart of Accounts / Trial Balance," enter Morise Agro
Ltd's company ID, and generate with no period ID for the chart of accounts
or with a period ID for a trial balance — the same figures the Accounting
screen's own Trial Balance tab shows. Try "Employees" as `s.namuli@...`
(Sales Manager, no `employee.viewAll`) to see it correctly refused with
`FORBIDDEN`, while "Customers" and "Suppliers" work for her — both need
only scope, not a special permission, matching the underlying screens
exactly.

**Dashboard, Notifications and Audit Trail (Sprint 14)**: log in as
`p.kintu@...` (Branch Manager, Morise Agro Ltd) and submit a new expense
claim from **Expenses** — the bell icon in the top bar for `s.namuli@...`
or `r.kato@...` (both hold `expense.approve.manager`) should show an
unread badge moments later; click it to see the notification, click the
notification to mark it read. Approve the claim as one of them, then check
`a.smith@...` (Finance Manager) for the finance-approval notification, and
finally `p.kintu@...` again for the "finance-approved" notification once
Smith approves. On **Dashboard**, `a.smith@...`'s subsidiary card now
shows Assets/Projects summaries and an "Awaiting Your Approval" section
whenever she has a pending expense or asset disposal — try
`r.kato@...` registering a new asset and requesting its disposal, then
check `m.okurut@...` (Managing Director, no explicit Agro scope row, only
group-wide `asset.viewAll`) gets notified too, confirming this sprint's
own targeting fix.

**Company and Holdings Management (19 August 2026)**: log in as
`m.okurut@...` (Managing Director) and open a company's **Details** page
to see the new **Policies** section — add a new policy, or view the
seeded "Group Leave Policy." Open **Inter-Company** to see the seeded
2,000,000 UGX loan from Morise Agro Ltd to Morise Logistics Ltd, already
`posted` — open it and confirm two separate balanced journal entries exist
on **Accounting → Journal Entries** for each company. Create a new
transaction and **Post…** it to see the two-sided account/period picker in
action. On **Reports**, pick "Subsidiary Comparison / Consolidated Group"
and generate (optionally with a period name like `FY2026-Q1`) to see every
subsidiary's headcount and financial figures side by side with a Group
total row. On **Assets**, try transferring an asset with a
"Move to different company" value as `r.kato@...` (Procurement Manager,
Morise Agro Ltd only) to see it correctly refused for lacking group-wide
scope on the destination company — the two-sided scope check this pass
added.

## Project structure

```
mbms/
├── docker-compose.yml     Postgres + Redis for local dev
├── backend/               NestJS (Fastify) API
│   ├── prisma/schema.prisma   Schema per 08_Database Design Document, Sections 3–4, 9
│   └── src/
│       ├── identity/       auth, users, roles/permissions
│       ├── organization/   companies, branches, departments, policies,
│       │                   inter-company-transactions (Company/Holdings pass)
│       ├── employees/      employee records (FR-USER-08 field masking)
│       ├── customers/      customer records, credit terms, statement
│       ├── suppliers/      supplier records, blacklist/unblacklist
│       ├── products/       products and product categories
│       ├── accounting/     accounts, financial-periods, journal-entries, reports,
│       │                   recurring-entries (FR-ACC-07, Sprint 10)
│       ├── expenses/       claims, approve (manager/finance), reject, pay & post (Sprint 9)
│       ├── assets/         registration, transfer, depreciation, disposal, maintenance (Sprint 11)
│       ├── projects/       team/tasks/milestones, status lifecycle, profitability (Sprint 12)
│       ├── reports/        company/employee/customer/supplier/accounting/audit-trail
│       │                   reports, CSV/PDF export (RPT-01–06, Sprint 13), plus
│       │                   company-comparison/consolidated group (Company/Holdings pass)
│       ├── notifications/  GET/POST own feed, unread-count, mark read/read-all (Sprint 14)
│       ├── dashboard/      group summary, accounting summary, subsidiary dashboard, recent
│       │                   activity, assets/projects/pending-approvals (Sprint 14)
│       ├── audit/          read-only GET /audit/logs
│       └── common/
│           ├── audit/            AuditService — the shared, in-process "publish" every
│           │                      module calls instead of a real Kafka producer
│           ├── notifications/    NotificationsService — in-app feed + fan-out targeting
│           │                      (Sprint 14)
│           ├── reports/          shared toCsv/buildPdfTable utilities (Sprint 13)
│           └── ...               response envelope, error mapping, JWT guard, RBAC
└── frontend/               React + Vite + JavaScript
    └── src/
        ├── pages/           Login, Dashboard, Companies, CompanyDetail, Employees,
        │                    Customers, Suppliers, Products, Accounting, Expenses, Assets,
        │                    Projects, Reports, InterCompanyTransactions, Users, Profile,
        │                    AuditTrail
        ├── components/      Layout (nav + NotificationBell, Sprint 14), RequireAuth
        └── styles/app.css   Same design tokens as the Administrator mockups
```

## Next steps

Every Phase 1 module in `04_Software Requirements Specification`, Section
2.2 is now built, including the Audit Trail. What's left for Phase 1 isn't
new modules — it's closing the architecture gap discussed above (API
Gateway, Kafka, per-service databases, observability stack) if the Board
wants this proof-of-concept brought into conformance with the approved
`07_System Design Document` v2.0. Audit Trail coverage was checked again
at Sprint 14 specifically for the three newest modules (Expenses, Assets,
Projects) and found comprehensive — every mutation in all three already
audited, not a representative subset; the original Phase 1 modules'
coverage (Sprint 1–8) was never re-audited to the same standard and
remains "at least one mutation per service," not exhaustively verified.

Per `Multi_Holdings_Limited_Software_Development_Procedures.docx`'s own
14-sprint order (see "Sprint 10," above), this project has now attempted
every sprint except three: Expense Management (9), Full Accounting (10),
Asset Management (11), Project Management (12), Reports (13) and
Dashboard/Notifications/Audit Trail (14) are all built. Only Procurement
(Sprint 6), Sales (Sprint 7) and Inventory (Sprint 8) remain — the three
sprints redirected away from early in this project's history before this
second sprint table was discovered at Sprint 10, for the reason that
update explains in full. Building those three, in that order, closes out
every row in the Group's own 14-sprint development order.

Beyond the 14-sprint order itself: Notifications (Sprint 14) covers two
workflows as a demonstrated pattern, not every workflow in the system —
extending it to recurring-entry generation, project milestone due dates,
and every other approval-gated action is natural, mechanical follow-up
work. Real email/push delivery, a job scheduler for recurring
entries/milestone reminders, and object storage for every deferred
document-upload field across Companies/Employees/Suppliers/Expenses/
Assets/Projects all remain open infrastructure gaps this proof-of-concept
has documented honestly rather than faked, sprint over sprint.

The 19 August 2026 Company and Holdings Management pass closed out the
last items in `morise.docx` Section 2's feature list that weren't already
covered by Sprint 2 (hierarchy/ownership/registration/tax/address/contact)
or Sprint 10 (per-company currency and financial years): policies,
inter-company transactions, cross-company asset transfer, and consolidated
group comparison reporting. What's left there isn't a missing feature so
much as depth: inter-company transactions currently support one
transaction type's worth of account wiring per post (loan/transfer/
service-charge/cost-allocation/other all share the same clearing-account
mechanism rather than each having type-specific ledger treatment), and no
demo persona proves the full cross-company asset-transfer success path
end-to-end (see "Judgment calls," item 21) — both natural next increments
rather than open design questions.

The same-day Dashboard Deepening pass closed out the full Holding Company/
Subsidiary Dashboard KPI list requested against `04_Software Requirements
Specification`'s existing FR-DASH group, except the three tiles genuinely
blocked on modules this codebase doesn't have — Inventory Value, Sales
Performance, Procurement Performance. Sprint 16 (below) unblocks Sales
Performance's underlying data (real `Order`/`Invoice`/`Payment` records
now exist); the dashboard tile itself hasn't been wired to read it yet —
a natural, small follow-up. Procurement (Sprint 6) and Inventory
(Sprint 8) — the two sprints still open from the 14-sprint order above —
remain needed to unblock the other two tiles.

## Sprint 16: Customer Storefront (19 August 2026)

The request that opened this sprint asked for the actual storefront
`screenshots/Customer/`'s 10 mockups had always implied but never had
running code behind them — this codebase's first customer-facing (not
staff-facing) web app, plus everything it needs from the backend: a real
Sales/Invoicing/Payments module (this project's last fully-deferred Phase
1 sprint, per the 14-sprint order above) and a new Support Ticketing
module neither `17_Development Plan` nor the 14-sprint order names at
all. Confirmed with the requester before building: minimal staff-side
screens (order fulfillment, ticket reply) were in scope too, so a
customer's order/ticket isn't a write-only dead end — the same
reachability standard every other module in this system already holds
itself to.

**What was built**:

- **Customer identity, structurally separate from staff `User`**: a
  second Passport strategy (`customer-jwt`, `src/customer-portal/common/`)
  with its own secret, its own minimal per-request-revalidated payload,
  and a new `CustomerRefreshToken` table (`RefreshToken` hard-FKs to
  `User`, so it can't be reused) — mirroring `AuthService`'s login/
  refresh/logout/5-attempt-lockout logic exactly, against `Customer`
  instead of `User`. Login accepts email or account number
  (`Customer.accountNumber`, a new unique field, e.g. `CUST-0118`) plus
  password (`Customer.passwordHash`, also new). The mockup's mobile-OTP
  option is deferred, same honest gap as SEC-07/2FA — no SMS provider
  exists in this codebase.
- **Catalog** (`src/customer-portal/catalog/`): read-only, scoped to the
  calling customer's own selling company (`Product.unitPrice`/
  `stockQuantity`, two new nullable fields), showing only priced, active
  products — an unpriced product is staff-incomplete data, not a UGX 0
  listing.
- **Sales** (`src/sales/`, new `Order`/`OrderItem`/`Invoice` tables): cart
  is client-side only (the storefront app, localStorage) — nothing models
  a server cart, only the `Order` it becomes at checkout. Placing an
  order posts a real balanced journal entry (Dr Accounts Receivable, Cr
  Sales Revenue) in the same transaction as the order and its invoice,
  the same `$transaction`-based posting pattern `expenses.service.ts`'s
  `pay()` established in Sprint 9, and rejects an order that would push
  the customer's outstanding balance over their `creditLimit`
  (`CONFLICT`, matching BR-03/BR-04's error-code convention).
  Cancellation (only while `placed`/`confirmed`) reverses that entry
  rather than deleting anything, per this codebase's own
  "status-not-hard-delete" convention. **Judgment call**: the
  payment-method selector shown at checkout captures the customer's
  stated preference only — actual money movement always happens later,
  through Payments (below), never at order placement, since this
  codebase has no real payment gateway to execute a "pay now" choice
  against anyway. Staff advance an order through `placed → confirmed →
  packed → out_for_delivery → delivered` one step at a time
  (`POST /sales/orders/{id}/advance-status`), the same
  single-repeated-action shape Asset disposal already uses.
- **Invoices & Payments** (`Payment`/`PaymentAllocation` tables):
  overdue/due-soon/paid is computed at read time from `dueDate`/`paidAt`,
  never stored, avoiding a stale-status bug class. A payment can cover
  several invoices at once (the mockup's "Select Invoices to Pay"
  checkboxes), posting one balanced entry (Dr Cash/Bank, Cr Accounts
  Receivable) and marking every selected invoice paid. `customers.service.ts`'s
  `statement()` — an honestly-empty stub since FR-CUST-03 was first built,
  because no Sales service existed yet — now returns real transaction
  history with a running balance; `CustomerInvoicesController` exposes a
  PDF invoice/statement export reusing the same `buildPdfTable` helper
  Reports already uses.
- **Support Tickets** (new module, `src/support/`, `SupportTicket`/
  `TicketMessage` tables): a customer creates a ticket (category/
  priority/subject/description, optionally linked to an order or
  invoice) and replies in a thread; staff reply and resolve. Status
  starts (and stays, on any new customer message) at `awaiting_reply` —
  from the customer's own perspective, their ticket is awaiting a reply
  from Morise Holdings; a staff reply doesn't auto-resolve it, staff do
  that explicitly. `open`/`closed` are left in the enum unused by this
  MVP's logic, the same honestly-unused-enum-value convention
  `AuditAction`'s own `delete` value already established (Sprint 6).
- **`mbms/storefront/`**: a second Vite/React app (port 5174), sibling to
  the existing Admin app, sharing the same backend but a completely
  separate token namespace (`storefront.*` vs. `mbms.*` `localStorage`
  keys) so a staff and a customer session coexist in the same browser.
  New visual design (`styles/storefront.css`) matching the mockups —
  navy header, orange CTA accent, card-grid catalog — while mirroring the
  Admin app's *code* conventions (`apiRequest`/`apiRequestWithMeta`,
  401-refresh-retry, `{data,error}` envelope handling) exactly. All 10
  mockup screens were built: Login, Home (dashboard), Shop, Product
  Detail, Cart & Checkout, My Orders (with a live status tracker), 
  Invoices & Account Statement, Make a Payment, Support Tickets, My
  Account (profile + delivery addresses — the mockup's Documents &
  Contracts and Notification Preferences sections were **not** built:
  no object-storage infrastructure exists for the former, the same gap
  already noted for Company logos/Employee/Supplier documents, and the
  latter had nothing real to back it without email/SMS delivery
  infrastructure this codebase has never had — building either as inert
  decoration would violate this project's own no-fake-UI convention).
- **Staff-side additions to the existing Admin app**: an **Orders** page
  (list + advance/cancel actions) and a **Support Tickets** page (list +
  reply/resolve), plus `unitPrice`/`stockQuantity` fields added to the
  Products create form and list (staff must price a product before a
  customer can see it in the catalog).
- **Permissions added**: `sales.order.manage`/`sales.order.viewAll`
  (Super Administrator gets both; Sales Manager and Branch Manager get
  `manage` — order fulfillment is a branch-level physical operation;
  Managing Director/Group CEO/Auditor get `viewAll`) and
  `support.ticket.manage`/`support.ticket.viewAll` (Super Administrator
  and Customer Service Officer get `manage` naturally). **Demo-reachability
  fix, found during this sprint's own verification** (the same class of
  gap Sprint 2's "no seeded user held `organization.company.manage`"
  finding was): no seeded demo user holds Customer Service Officer, so
  IT Administrator — the seeded "closest to Super Administrator"
  persona every earlier sprint's own demo-reachability fix already
  reaches for — was granted `support.ticket.manage` **and**
  `support.ticket.viewAll` too (the latter because IT Administrator's own
  `UserScope` row is the root holding company, which never has tickets —
  without group-wide visibility the `manage` grant would have been
  unreachable regardless). A second, matching bug was caught in the
  **frontend**: `SupportTicketsPage.jsx`'s `canManage` check was
  hardcoded to `hasRole('Super Administrator', 'Customer Service Officer')`
  — correct permission on the backend, but the UI's reply form stayed
  hidden for IT Administrator until the role list was corrected to match.

**Verified end-to-end**: a curl matrix covering customer login/refresh/
lockout; an order placed over the credit limit correctly rejected
(`CONFLICT`); a valid order producing a real balanced journal entry
(confirmed via `GET /accounting/journal-entries`) and its own invoice;
cancelling that order reversing the entry and dropping the customer's
outstanding balance back to its pre-order figure; a staff user advancing
an order through every fulfillment status; a payment against an overdue
invoice marking it paid and posting its own balanced settlement entry; a
support ticket created by the customer, replied to by staff, and the
reply visible back on the customer's own side of the same thread; and
cross-customer/cross-company scope isolation on every new endpoint. **A
real, reproducible bug was found and fixed during this pass, not before
it**: `prisma/seed.ts`'s new demo-order-history block generated its
`orderNumber`/`invoiceNumber`/`entryNumber` from a live `prisma.count()`
at seed time rather than a fixed literal — unlike every other upsert in
that file, re-running the seed script after a partial run minted a
*fresh*, higher-numbered batch instead of recognizing the first one,
silently doubling Highland Traders Ltd's outstanding balance (to 30.6M
against a 20M credit limit) and making every subsequent "place an order"
test fail its own credit-limit check. Fixed by guarding that whole block
behind a single `prisma.order.count({customerId})` check, all-or-nothing,
the same idempotency standard the rest of the seed file already meets by
keying on a real unique field. A Playwright pass (via a plain
`chromium.launch()` script — `chromium-cli` wasn't available in this
session, the same fallback path this project's own tooling notes allow)
walked all 10 storefront screens end-to-end (login → browse → add to
cart → checkout → track → pay an overdue invoice → raise a ticket →
edit account) and the 3 new/changed Admin screens (Orders, Support
Tickets, Products), confirming zero console/page errors throughout.

No Procurement or Inventory code was added — Sprint 16 built the
Customer Storefront (Sales/Invoicing/Payments/Support plus its own web
app) only, the one module actually requested.

## Storefront responsiveness pass (19 August 2026)

Sprint 16 shipped `mbms/storefront/` without a mobile/tablet pass —
reasonable for a first cut, but a real gap the moment anyone actually
opened it on a phone. This pass closed it, in two rounds.

**Round 1** covered the obvious cases: the header wraps (search bar
drops to its own line, brand/account name truncate), the nav scrolled
horizontally, tables scroll inside their card instead of breaking page
width, two-field form rows stack, the payment-method picker drops to one
column, and the login card's fixed 380px width was capped at `90vw` so
it no longer overflowed a 320–375px phone. Verified with Playwright at
375/768/1440px — zero console errors, zero horizontal overflow.

**Round 1 was not actually enough**, and re-verification (prompted by
being told plainly it "isn't responsive yet") is the reason this pass
has two rounds recorded rather than one: testing only at three exact
breakpoint widths hid a real bug in the ~480–1150px zone between them,
where the header's search box got squeezed into an unreadably thin
sliver — a fixed `@media (max-width: 768px)` rule gave the header
nothing to do at, say, 900px. **Round 2** fixed the actual root cause
instead of adding a third breakpoint: the topbar now uses `flex-wrap`
with explicit `order` (brand and the cart/account cluster pinned to
line 1, search given a real `min-width` so it wraps to its own full-
width line the moment it doesn't fit) — fluid at *any* width, not just
at hand-picked ones. The nav switched from a hidden horizontal-scroll
(items past the edge had no visible affordance that they existed) to
visible wrapping, so every link stays on screen. Re-verified with a
13-point width sweep from 320px to 1440px, including live in-page
resizes (not just fresh loads at a fixed viewport, which is what round
1's testing method had quietly relied on) — zero overflow and the
search box never dropped below a readable width anywhere in that range.

## Landing page and disclaimer added (19 August 2026)

`mbms/storefront/` had no public entry point at all before this pass —
`/` was wrapped in `RequireAuth` and force-redirected an unregistered
visitor straight to `/login`, the same "every screen requires a session"
shape every other route in this app correctly has, but wrong for the
one route a first-time visitor actually lands on.

**What was built**: `/` now renders `<LandingPage/>` for a signed-out
visitor and the existing dashboard for a signed-in customer (`RootPage`,
a two-line switch in `App.jsx` on `useAuth()`'s `customer` state — every
other route stays exactly as gated as before). The Landing page itself:
a hero with a real CTA into `/login`, a persistent disclaimer strip, a
six-tile feature grid (one tile per real, working capability — catalog,
order tracking, invoices/statements, online payment, support tickets,
account management — nothing listed that isn't actually built), a "how
it works" 3-step section, and a footer. A disclaimer modal greets a
visitor automatically the first time (gated on a `localStorage` flag so
a returning visitor isn't nagged every visit — re-verified: reload after
acknowledging does not reshow it), stating plainly that this is a
demonstration/proof-of-concept environment, that payments are simulated
with no gateway connected, that all data is fictional, and that there is
no public self-registration — the same honesty-about-what-this-is
standard this README has held throughout, now surfaced to the one
audience (an unregistered first-time visitor) who most needs to see it
before anything else. No fake "Create an account" CTA was added, since
self-registration doesn't exist — matching the project's own
no-fake-UI convention, the same reasoning that already kept Documents &
Contracts and Notification Preferences off the My Account screen in
Sprint 16.

Two real screenshots were captured against the running app (not mocked)
and saved to `screenshots/Customer/00-landing.png` and
`00-landing-disclaimer.png` — numbered `00` since the landing page is
the one screen in this set that precedes login, matching the mockup
folder's own `NN-description.png` convention for every screen after it.

**A real bug was found and fixed during this pass**: the responsiveness
pass above had added `order: 1` to the shared `.sf-brand` CSS class to
fix the signed-in app shell's header wrap — global, not scoped to that
header. The Landing page's own header reuses the same `.sf-brand` class
but lays out left-to-right by plain DOM order with no matching `order`
on its own elements, so the leaked rule silently placed "Sign In" to the
*left* of the logo instead of the right. Caught by looking at the
captured screenshot, not by any automated check (Playwright's overflow/
console-error assertions had no way to catch a purely visual reordering
with no error and no layout overflow) — fixed by scoping the rule to
`.sf-topbar .sf-brand` specifically. Re-verified: full responsive sweep
re-run with zero regressions, and the corrected screenshots re-captured.

## Corporate landing page & public mini-site (29 August 2026)

The single Landing page above is **superseded** by a small **public,
pre-login holding-company site**. The page **layouts** follow the reference
mockups in `screenshots/files(13)/*.html`; the **styling matches the shop
page** — it uses the storefront design system (`storefront.css`): the
system-font stack, the navy `#1E3A5F` / blue `#2E5395` / amber `#D97706`
palette, `#F2F5FA` background and white 10px cards.

> The mockups' original "paper & bronze" treatment (imported Fraunces /
> IBM Plex Mono web fonts, cream `#F2F0EA` background, serif headings) was
> the first cut and was **dropped on 29 Aug 2026** — the corporate pages
> now load no external fonts. Only `styles/corporate.css` changed; its
> `mc-*` class names and every page/route/endpoint are unchanged.

**Public routes** (none behind `RequireAuth`):

| Route | Page |
|---|---|
| `/` (signed out) | Holding-company landing — hero, four-cell figure strip, Companies grid, letter-to-shareholders band, Related row |
| `/companies` | Companies directory with sector filter chips |
| `/companies/:id` | One subsidiary — stat block, about, branch network, "shop this" CTA |
| `/profile` | Profile / who-we-are + approach pillars |
| `/governance/board` | Group leadership (illustrative, from seeded staff personas) |
| `/investors/overview` | Group Overview — footprint headline, illustrative trend, per-subsidiary breakdown table |
| `/investors/news` | News list (illustrative demo announcements) |
| `/contacts` | Contact cards + a demo (non-submitting) message form + registered office |
| `/page/:slug` | Published CMS content — About / Terms / Delivery — in the same `CorporateLayout` shell (`ContentPage`, restyled 29 Aug 2026) |

`/` still shows the **customer dashboard** for a signed-in customer
(`RootPage` unchanged); the authenticated storefront's look is unchanged.

**One new backend endpoint** — `GET /api/v1/customer-portal/public/overview`
— **public, no customer token**. Returns only already-public facts:

```jsonc
{
  "holdingCompany": { "id", "name", "address", "contactEmail", "contactPhone", "currency" },
  "figures":        { "subsidiaries", "branches", "products", "categories" },
  "subsidiaries": [ { "id", "name", "address", "relationshipType",
                      "ownershipPercent", "currency", "branchCount",
                      "productCount", "branches": [ { "id", "name", "address" } ] } ]
}
```

It honours `Accept-Language`. No schema or migration change — it reuses
the group-catalogue resolution (`resolveHoldingGroupCompanyIds`),
generalised into `CustomerCatalogService.listGroupOverview(lang)` which
takes **no customer** (the root holding company is the one active company
with no parent). `CustomerCatalogModule` now `exports` its service;
`CustomerStorefrontModule` imports it and mounts the new
`CustomerPublicController`.

**Files**

```
mbms/backend/src/customer-portal/catalog/customer-catalog.service.ts   # + listGroupOverview(lang)
mbms/backend/src/customer-portal/catalog/customer-catalog.module.ts    # exports CustomerCatalogService
mbms/backend/src/customer-portal/storefront/customer-storefront.controller.ts  # + CustomerPublicController (public)
mbms/backend/src/customer-portal/storefront/customer-storefront.module.ts      # imports CustomerCatalogModule
mbms/storefront/src/styles/corporate.css              # mc-* namespace; tokens mirror storefront.css (navy/white/amber, system fonts)
mbms/storefront/src/components/CorporateLayout.jsx    # utility bar + nav + footer + disclaimer
mbms/storefront/src/lib/corporate.js                  # useGroupOverview() + SUBSIDIARY_META + demo leadership/news
mbms/storefront/src/pages/corporate/*.jsx             # Home, Companies, CompanyDetail, Profile, Board, GroupOverview, News, Contacts
mbms/storefront/src/pages/Landing.jsx                 # now re-exports corporate Home as LandingPage
mbms/storefront/src/pages/Page.jsx                    # ContentPage (/page/:slug) now renders in CorporateLayout + mc-* (29 Aug 2026)
mbms/storefront/src/App.jsx                           # 7 new public routes
mbms/storefront/src/locales/en.js                     # + corp.* keys (other languages fall back to English)
```

**Content honesty**: the Companies grid, per-company pages and Group
Overview table are populated **live** (4 subsidiaries, 14 branches, 24
catalogue items). Sector labels / one-line blurbs are presentation-only
(`SUBSIDIARY_META`, keyed by name, generic fallback). Group leadership and
news are labelled illustrative demo data. The demonstration disclaimer
strip + modal now appear on **every** corporate page.

**Verified**: signed out, `/` renders the holding-company landing with
live figures **in the storefront's navy / white / amber styling**, sitting
visually alongside `/shop`; all seven public routes **plus `/page/about`
and `/page/terms`** load without a token in the same shared chrome;
`GET /customer-portal/public/overview` → `200` with the documented shape;
`npx vite build` passes (71 modules); no external font is requested;
signing in still lands on the customer dashboard.

## Social media channels (29 August 2026)

An administrator adds the group's social media channels in **Admin » CMS /
Site Builder**; they render in the **storefront footer** — both the
pre-login corporate pages (`CorporateLayout`) and the signed-in customer
pages (`Layout`).

**Data** — new table `social_links` (migration
`20260829180000_social_media_links`), site-wide (not per-company):

| Column | |
|---|---|
| `platform` | enum `SocialPlatform` — `facebook` · `x` · `instagram` · `linkedin` · `youtube` · `tiktok` · `whatsapp` · `telegram` · `other` |
| `label` | optional display text (falls back to the platform name) |
| `url` | absolute `http(s)` URL |
| `sort_order` | footer order |
| `is_visible` | hide from the storefront without deleting |
| `created_by` | logical user ref (no FK, as on `content_blocks`) |

**API** — no new permission; reuses `cms.manage` / `cms.viewAll`:

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/v1/cms/social-links` | `cms.viewAll` or `cms.manage` |
| `POST` | `/api/v1/cms/social-links` | `cms.manage` |
| `PATCH` | `/api/v1/cms/social-links/:id` | `cms.manage` |
| `DELETE` | `/api/v1/cms/social-links/:id` | `cms.manage` |
| `GET` | `/api/v1/customer-portal/public/social-links` | **public, no token** — visible only, admin order, `[{ platform, label, url }]`, `Accept-Language` on `label` |

Every write is audited (`cms.social_link.created` / `updated` / `deleted`,
`entity_type` `social_link`).

**Files**

```
mbms/backend/prisma/schema.prisma + migrations/20260829180000_social_media_links/   # SocialLink model + SocialPlatform enum
mbms/backend/src/cms/social-links.service.ts                     # CRUD + listPublic(lang); audited
mbms/backend/src/cms/dto/social-link.dto.ts                      # Create/Update DTOs (IsUrl, platform whitelist)
mbms/backend/src/cms/cms.{controller,module}.ts                  # /cms/social-links routes; provider + export
mbms/backend/src/customer-portal/storefront/customer-storefront.controller.ts  # GET /customer-portal/public/social-links
mbms/backend/prisma/seed.ts                                      # 4 visible + 1 hidden channel (MD-owned, fixed ids)
mbms/frontend/src/pages/Cms.jsx                                  # "Social media channels" panel (list, toggle, re-order, add, remove)
mbms/storefront/src/lib/corporate.js                             # useSocialLinks() + socialIcon / socialLabel
mbms/storefront/src/components/CorporateLayout.jsx               # footer "Follow us" row
mbms/storefront/src/components/Layout.jsx + styles/storefront.css # signed-in footer + .sf-social styles
mbms/storefront/src/styles/corporate.css                         # .mc-social styles
mbms/storefront/src/locales/en.js                                # corp.footer.followUs
```

**Verified**: as the Managing Director, `POST` + `PATCH` on
`/cms/social-links`; `GET /customer-portal/public/social-links` reflects
the visible set instantly (the seeded hidden WhatsApp channel is excluded,
and appears the moment `isVisible` is set true); storefront **and** admin
`vite build` pass; OpenAPI documents the 3 new paths (249 total).

## Landing-page newsletter & FAQ (29 August 2026)

The corporate landing page gains a **Newsletter sign-up band** and an
**FAQ section**. FAQ items are managed by an admin in **CMS / Site
Builder**; newsletter sign-ups are captured from the landing page and
listed there too.

**Data** — two new tables (migration `20260829200000_landing_faq_newsletter`),
site-wide:

| Table | |
|---|---|
| `faq_items` | `question` (≤300), `answer` (text), `sort_order`, `is_visible`, `created_by`, timestamps |
| `newsletter_subscribers` | `email` **unique**, `status` (enum `subscribed` / `unsubscribed`), `source` (e.g. `landing`), timestamps |

**API** — no new permission; reuses `cms.manage` / `cms.viewAll`:

| Method | Path | Auth |
|---|---|---|
| `GET`/`POST` | `/api/v1/cms/faqs` | read `cms.viewAll`+, write `cms.manage` |
| `PATCH`/`DELETE` | `/api/v1/cms/faqs/:id` | `cms.manage` |
| `GET` | `/api/v1/cms/newsletter-subscribers` | `cms.viewAll` — `{ total, subscribed, unsubscribed, subscribers[] }` |
| `DELETE` | `/api/v1/cms/newsletter-subscribers/:id` | `cms.manage` |
| `GET` | `/api/v1/customer-portal/public/faqs` | **public** — visible, admin order, `[{ id, question, answer }]`, `Accept-Language` |
| `POST` | `/api/v1/customer-portal/public/newsletter` | **public** — `{ email, source? }` → `{ subscribed: true }`; **10/min/IP**, idempotent, non-enumerating, HTTP `201` |

FAQ writes audited (`cms.faq_item.*`); a subscriber delete audited
(`cms.newsletter_subscriber.deleted`).

**Files**

```
mbms/backend/prisma/schema.prisma + migrations/20260829200000_landing_faq_newsletter/   # FaqItem, NewsletterSubscriber, NewsletterStatus
mbms/backend/src/cms/faq.service.ts + newsletter.service.ts        # CRUD / listPublic / subscribe (idempotent); audited
mbms/backend/src/cms/dto/faq.dto.ts + newsletter.dto.ts           # Create/Update FAQ; NewsletterSubscribe (@IsEmail)
mbms/backend/src/cms/cms.{controller,module}.ts                    # /cms/faqs + /cms/newsletter-subscribers; providers + exports
mbms/backend/src/customer-portal/storefront/customer-storefront.controller.ts  # public /faqs (GET) + /newsletter (POST, @Throttle)
mbms/backend/prisma/seed.ts                                        # 5 FAQ items (4 visible, 1 hidden), MD-owned
mbms/frontend/src/pages/Cms.jsx                                    # FaqPanel + NewsletterPanel
mbms/storefront/src/lib/corporate.js                              # useFaqs() + subscribeNewsletter()
mbms/storefront/src/pages/corporate/Home.jsx                      # <NewsletterSection/> + <FaqSection/>
mbms/storefront/src/styles/corporate.css                          # .mc-newsletter, .mc-faq
mbms/storefront/src/locales/en.js                                 # corp.home.newsletter* / corp.home.faq*
```

**Verified**: as the Managing Director, listed / edited FAQ via `/cms/faqs`;
`GET /customer-portal/public/faqs` returned only the visible 4;
`POST /customer-portal/public/newsletter` accepted a new address and a
repeat (both `201`), rejected a malformed one (`400`), and the sign-up
showed in `GET /cms/newsletter-subscribers`; storefront **and** admin
`vite build` pass; OpenAPI documents the 6 new paths (255 total).

## Content localisation — orders & payments (30 August 2026)

The storefront's **read-in-language / store-in-English** rule (Updates 32 /
33 / 39 / 48) now also covers **order history** and **payments** — the two
customer-facing areas it had not yet reached.

**Read** — the storefront already sends `Accept-Language` on every request,
so with this change:

| Endpoint | Now localised |
|---|---|
| `GET /customer-portal/orders`, `/orders/:id` | line-item `productName`, selling `companyName`, `cancellationReason` — in the customer's language; digits in its script |
| order-placed response (`POST /customer-portal/orders`) | same |

When the customer **cancelled in the language they're now browsing in**,
`cancellationReason` returns their **exact original wording**; any other
reader (incl. staff/admin) gets the stored English.

**Write** — stored English + 0-9:

- **`POST /customer-portal/orders/:id/cancel`** — a typed `reason` is run
  through `ContentTranslationService.toEnglish`; the row stores the English
  in `cancellation_reason`, the customer's exact words in
  `cancellation_reason_original`, and the language in
  `cancellation_source_language` (migration
  `20260829210000_order_cancellation_reason_localisation` — two nullable
  columns on `orders`). A **staff** cancel stores English only.
- **`POST /customer-portal/payments`** — `reference` (a bank / mobile-money
  txn id) has its **digits normalised to 0-9** on write. It's an
  identifier; nothing else changes.

**No new endpoint, no new permission.**

**Files**

```
mbms/backend/prisma/schema.prisma + migrations/20260829210000_order_cancellation_reason_localisation/   # Order.cancellationReasonOriginal / cancellationSourceLanguage
mbms/backend/src/sales/orders.service.ts        # toOrderResource(o, lang, translation); list/get/create/cancelForCustomer take lang; cancel stores EN + original
mbms/backend/src/sales/payments.service.ts      # normaliseReference() digit-normalises on createForCustomer
mbms/backend/src/customer-portal/orders/customer-orders.controller.ts   # injects ContentTranslationService, reads Accept-Language on list/get/create/cancel
```

**Verified**: in Swahili, order `ORD-2026-0011`'s `Bean Seed — 10kg Bag` →
`Maharage Mbegu — 10kg Mfuko`; cancelling with `reason: "Ghala"` (sw) stores
`cancellation_reason = "Warehouse"`, `cancellation_reason_original =
"Ghala"`, `cancellation_source_language = "sw"` — an English read returns
"Warehouse", the sw customer sees "Ghala"; payment reference `MP٢٤٠٨٢٩.٠٠١`
stored as `MP240829.001`. `npx nest build` clean; `openapi.json` regenerated
(255 paths).

### Final edges (30 August 2026)

A full sweep closed the last three gaps — the rule now holds **everywhere**:

| Path | Change |
|---|---|
| `GET /customer-portal/dashboard-summary` | reads `Accept-Language`; `dashboardSummary(customer, lang)` threads it into `OrdersService.listForCustomer` — the Home "Recent Orders" widget's item / subsidiary names localise |
| `GET /customer-portal/invoices/statement` | each row gains `typeLabel` (`invoice`/`payment`) in the customer's language |
| `GET /invoices/statement/pdf`, `/invoices/:id/pdf` | the exported **PDFs** are labelled in the customer's language (title, "Balance", column headers, row type, invoice status), digits transliterated. Storefront `downloadFile` now sends `Accept-Language`. **Limit:** PDFKit's built-in font renders Latin scripts + 0-9 only — a non-Latin script keeps label words in English (font-embedding follow-up) |
| `POST /customer-portal/orders`, `POST /customer-portal/discount-codes/validate` | a typed **discount code** is digit-normalised to 0-9 before the look-up (`WELCOME١٠` → `WELCOME10`), then upper-cased |

`InvoicesService` gains `ContentTranslationService` + a `loc()` helper;
`content-glossary.ts` gained the statement / PDF label vocabulary (8
languages: "Account Statement", "Balance", "Date"/"Type"/"Reference"/
"Amount"/"Running Balance", "Order", "Status", "Invoice Number", "Due Date",
"Paid At", the row types, and the invoice statuses). **No new endpoint,
permission or schema change.**

**Files:** `customer-account.{controller,service}.ts`,
`invoices.service.ts`, `customer-invoices.controller.ts`,
`orders.service.ts` + `marketing.service.ts` (discount code),
`common/translation/content-glossary.ts`, `storefront/src/lib/api.js`
(`downloadFile`).

**Verified**: in Swahili the dashboard's recent orders read `Maharage Mbegu
— 10kg Mfuko`; statement rows `ankara` / `malipo`; the statement PDF header
`Taarifa ya Akaunti — … Tarehe / Aina / Kumbukumbu / Kiasi / Salio
Linaloendelea` (French: `Relevé de compte — … Date / Type / Référence /
Montant / Solde courant`); a discount code `WELCOME١٠` matched `WELCOME10`.
Backend + both front-end builds clean; `openapi.json` regenerated (255 paths
— `Accept-Language` added to the four routes).

## Collateral Management subsidiary (30 August 2026)

A **third specification-stage subsidiary** — **Morise Collateral Management
Ltd**, a wholly-owned collateral management agent (CMA) that monitors
physical goods pledged as collateral for banks and financiers across client
sites (warehouses, silos, tank farms, yards, cold stores). **Seed data only
— no code, schema or permission change.**

**Org structure** (`prisma/seed.ts`, company id
`a1000000-0000-4000-8000-000000000006`, wholly-owned, UGX, FY 1 Jan):

| | |
|---|---|
| **6 sites / branches** | Kampala Head Office · Jinja Grain Silos · Mbale Warehouse · Masindi Grain Store · Kasese Cold Store · Buikwe Tank Farm |
| **9 departments** | Field Inspection · Site & Warehouse Management · Stock & Collateral Control · Inspection & Audit · Release & Movement Authorization · Client & Lender Relations · Compliance & Risk · Workforce & Rostering · IT & Integrations |
| **6 starter policies** | GPS & Evidence Integrity · Dual-Control Release Approval · Coverage Threshold Auto-Hold · Offline Field Sync · Multi-Client Stock Segregation · Inspection Frequency by Risk |

Fully manageable by the Managing Director via the subsidiary-lifecycle
capability. It appears in the org companies list and the public group
overview. A `SUBSIDIARY_META` entry (sector "Collateral management" +
blurb) was added in `storefront/src/lib/corporate.js` for its
corporate-site card.

**Priced services catalogue (30 August 2026)** — the subsidiary now sells
**10 services** in the group storefront (`CMC-5001`–`CMC-5010`), mapped
from the client's `docx/Collateral-Management-Company-Services-Catalog.docx`
onto its six sites, across five categories (Custody & Control · Inspection &
Verification · Stock & Movement Control · Risk & Valuation · Reporting &
Compliance): CMA setup & onboarding; Field Warehousing Control; Stock
Inspection Visit; Weighbridge & Tank/Silo Gauging; Stock Reconciliation &
Variance Report; Dual-Control Release Authorization; Collateral Valuation &
Coverage-Ratio Monitoring; Daily Stock-Position Reporting + Lender Portal;
Warehouse Receipt Issuance; Facility/Site Accreditation Assessment. It gets
the standard 6-account chart + an open FY2026-Q1 period
(`ensureStorefrontBooks`), so its orders invoice / GL-post in its own books
— same as Update 47's C&F / WMS. Five category names + ~25 service-name
tokens added to `content-glossary.ts` so the rows localise (rough word
order beyond the glossary, the documented limit). **Seed only** — no code,
schema or permission change; the group-storefront engine already supports
any number of sellers. Group figures now **34 products across 18
categories**. `docx/21` gains a **"Services Catalogue Seeded into the
Storefront"** addendum.

**Spec** — the **Multi-Site Collateral Management System** (10 feature
modules: site & warehouse management with geofencing; an offline-first field
inspector mobile app; staff & workforce management; per-site stock &
collateral management with a valuation / coverage engine; inspection & audit
workflow; dual-control release & movement authorization with lender OTP; a
client / lender portal; alerts & notifications; reporting & compliance;
document management — plus non-functional requirements, architecture,
integration & roadmap tables, user roles, technology stack) is captured in
the **new numbered document `docx/21_Multi-Site Collateral Management System
— Feature Specification …`**, restating the client-supplied
`docx/Multi-Site-Collateral-Management-System-Feature-Specification.docx` in
the house format of docs 19 / 20. **The CMS platform itself is not built** —
only the priced services catalogue above is live. When any module is built
it follows doc 21 §10 — reuse the platform's identity, per-site scope, GL,
audit, notification, workforce and localisation layers, not a parallel
stack.

**Files:** `mbms/backend/prisma/seed.ts` (subsidiary block + policies +
`CMC-5001`–`CMC-5010` services + `ensureStorefrontBooks`),
`mbms/backend/src/common/translation/content-glossary.ts` (5 category
phrases + ~25 service-name tokens ×8),
`mbms/storefront/src/lib/corporate.js` (`SUBSIDIARY_META`),
`docx/21_…docx` (new + Services Catalogue addendum).

**Verified:** after re-seed, `GET /customer-portal/public/overview` lists
Morise Collateral Management Ltd with **6 sites and 10 products** (group
figures **34 products / 18 categories**);
`GET /customer-portal/catalog/products?companyId=…006` returns the ten
priced, branch-tagged services, localised into Swahili / French on
`Accept-Language`; the DB holds the company + 6 branches + 9 departments +
6 policies + the 6-account chart + FY2026-Q1; the MD's
`GET /organization/companies` returns it; no migration ran.

## Full-page disclaimer gate (30 August 2026)

The demonstration disclaimer that used to be a dismissible modal over the
landing page is now a **full-page gate shown first** to a signed-out
visitor.

**Behaviour**

- Signed-out visitor at `/` → `DisclaimerGate` (a centred card on the navy
  gradient with the wordmark + language switcher, warning icon, "Before you
  continue" heading, the admin statements, a full-width button).
- The button is **disabled for `holdSeconds`** (10 by default, returned by
  the API) and reads *"Please read — continue in Ns"* with a live countdown;
  then it activates and reads **"I Understand, Continue"**.
- Continue → `localStorage['storefront.disclaimer_acknowledged'] = '1'` →
  landing page. A return visit renders the landing page directly.
- Deep-link corporate routes (`/companies`, `/companies/:id`, `/profile`,
  `/governance/board`, `/investors/*`, `/contacts`) are wrapped in
  `<CorporateRoute>` → redirect to `/` while un-acknowledged.
- `CorporateLayout`'s modal no longer auto-opens; it stays as the "Read
  disclaimer" re-opener (demo strip + footer), now fed by `useDisclaimer()`.

**Data** — new table `disclaimer_items` (migration
`20260830130000_site_disclaimer`), site-wide: `body` (text), `sort_order`,
`is_visible`, `created_by`, timestamps. The 10-second hold is the constant
`DISCLAIMER_HOLD_SECONDS` in `disclaimer.service.ts` (returned to the
client, not stored).

**API** — no new permission; reuses `cms.manage` / `cms.viewAll`:

| Method | Path | Auth |
|---|---|---|
| `GET`/`POST` | `/api/v1/cms/disclaimer-items` | read `cms.viewAll`+, write `cms.manage` |
| `PATCH`/`DELETE` | `/api/v1/cms/disclaimer-items/:id` | `cms.manage` |
| `GET` | `/api/v1/customer-portal/public/disclaimer` | **public** — `{ holdSeconds, items: [{ id, body }] }`, visible + admin order, `Accept-Language` on `body` |

Writes audited (`cms.disclaimer_item.*`).

**Files**

```
mbms/backend/prisma/schema.prisma + migrations/20260830130000_site_disclaimer/   # DisclaimerItem model
mbms/backend/src/cms/disclaimer.service.ts + dto/disclaimer.dto.ts               # CRUD + listPublic(lang) + DISCLAIMER_HOLD_SECONDS
mbms/backend/src/cms/cms.{controller,module}.ts                                  # /cms/disclaimer-items routes; provider + export
mbms/backend/src/customer-portal/storefront/customer-storefront.controller.ts    # GET /customer-portal/public/disclaimer
mbms/backend/prisma/seed.ts                                                      # 5 statements, MD-owned, fixed ids
mbms/frontend/src/pages/Cms.jsx                                                  # "Site disclaimer" panel
mbms/storefront/src/lib/corporate.js                                            # useDisclaimer() + acknowledge helpers
mbms/storefront/src/components/DisclaimerGate.jsx                               # the full-page gate
mbms/storefront/src/App.jsx                                                     # RootPage renders the gate; CorporateRoute guard
mbms/storefront/src/components/CorporateLayout.jsx                             # modal demoted to re-opener, fed by useDisclaimer()
mbms/storefront/src/styles/corporate.css + locales/en.js                       # .mc-gate styles; corp.disclaimer.* keys
```

**Verified**: signed out, `GET /customer-portal/public/disclaimer` → `200`
with `holdSeconds: 10` and the 5 seeded statements; as the MD, `POST` on
`/cms/disclaimer-items` made a new statement appear immediately on the
public endpoint (then removed); storefront + admin `vite build` pass;
`openapi.json` regenerated (258 paths — 3 new).

## Pre-login localisation — disclaimer gate & corporate pages (30 August 2026)

The pre-login corporate surface (the **disclaimer gate**, the **landing
page**, and the rest of the corporate mini-site) now renders in the
visitor's chosen language, not just English.

- **UI strings** — the **144 `corp.*` keys** (headings, labels, buttons,
  the demo strip, the disclaimer-gate countdown *"Please read — continue in
  Ns"*) are translated into the **8 fully-supported languages** in
  `locales/eu.js` (fr/es/pt/de/it) and `locales/regional.js` (sw/lg/ar).
- **Disclaimer statements** — the 5 seeded statements are added to
  `src/common/translation/content-glossary.ts` for the same 8 languages, so
  `GET /customer-portal/public/disclaimer` (which already honours
  `Accept-Language`) returns them **translated**. An admin-added statement
  beyond the seeded set falls through untranslated — the documented
  free-prose glossary limit.
- **First-visit language detection** — `i18n.jsx` `readInitialLang()` now
  resolves, in order: an explicit **`?lang=<code>`** on the URL (persisted
  to `localStorage`), then **`navigator.languages`**, then English. The
  language picker on the gate still overrides and remembers the visitor's
  explicit choice.
- **RTL** — a small `[dir='rtl']` block in `corporate.css` corrects the
  physically-placed bits for Arabic (the gate's list alignment, the Group
  Overview table's right-aligned figures, the FAQ question row, the
  two-column detail grids); the browser mirrors the rest from
  `document.dir`.

**Files:** `storefront/src/locales/{eu,regional}.js` (+144 `corp.*` each),
`storefront/src/lib/i18n.jsx` (`?lang=` + `navigator.languages`),
`storefront/src/styles/corporate.css` (`[dir='rtl']` block),
`backend/src/common/translation/content-glossary.ts` (5 disclaimer
statements ×8).

**Verified**: `/?lang=sw`, `/?lang=fr`, `/?lang=ar` render the disclaimer
gate — heading, the 5 statements, the countdown button, the hint line, the
"Customer sign in" link — entirely in that language, Arabic mirrored
right-to-left (`screenshots/disclaimer-gate-{swahili,french,arabic}.png`);
`GET /customer-portal/public/disclaimer` with `Accept-Language: sw|fr|ar`
returns the statements translated. Storefront + admin `vite build` pass;
`openapi.json` unchanged (no endpoint change).

## Managing Director — full operational authority (30 August 2026)

The **Managing Director** role now holds the **complete permission
catalogue — all 53 codes** (Super-Admin breadth + `identity.user.delegate`),
so the MD can **view, create, edit, approve and execute** on every section
of the four admin categories — **ADMIN / BACKEND**, **HUMAN RESOURCES**,
**MY HR**, **FINANCIAL & ACCOUNTING** — not only hold group-wide *view*.
`MY HR` needs no permission (it is scoped by the signed-in user's employee
record).

**Backend** — `ROLE_PERMISSIONS['Managing Director']` in `prisma/seed.ts`
expanded from a mostly-`viewAll` set to the full catalogue; adds the
`manage` / `approve` / `view.sensitive` codes it lacked:

```
employee.manage · employee.view.sensitive · accounting.manage ·
customer.manage · supplier.manage · supplier.view.sensitive · product.manage ·
asset.manage · recruitment.manage · attendance.manage · leave.manage ·
leave.approve · performance.manage · payroll.manage · sales.order.manage ·
support.ticket.manage · ap.manage · expense.approve.manager · expense.approve.finance
```

**Frontend** — **16 admin pages** (`Accounting`, `AccountsPayable`,
`Assets`, `Attendance`, `Customers`, `Employees`, `Expenses`,
`InterCompanyTransactions`, `Leave`, `Orders`, `Performance`, `Products`,
`Projects`, `Recruitment`, `Suppliers`, `SupportTickets`) had their
in-screen *manage / approve / create* controls gated by a **hard-coded role
list only**. Each now reads `hasRole(…) || hasPermission('<code>')`, so:

- the Managing Director (holding every code) sees every control, and
- **any** role/user granted that permission via delegated administration
  gets the control too — matching what the backend already enforces.

The newer screens (`Cms`, `Departments`, `Inventory`, `Marketing`,
`Payroll`, `ShiftScheduling`) already used `hasPermission(…)`.

**No new permission code, endpoint, schema or migration** — the API already
enforced these codes per route; only the seeded grants and the front-end
control visibility changed. `openapi.json` unchanged.

**Verified**: signed in as the MD, `GET /identity/auth/me` → **all 53**
permission codes; a read in every section of all four categories → `200`
(no `403`); `POST` (manage) to `/suppliers`, `/customers`, `/products`,
`/accounting/accounts`, `/assets`, `/attendance/shifts`,
`/recruitment/vacancies`, `/payroll/runs`, `/shift-scheduling/entries`,
`/employees` → `201` or `400 VALIDATION_ERROR` (never `403`). Admin +
storefront + backend builds pass.

**Files:** `backend/prisma/seed.ts` (MD role catalogue);
`frontend/src/pages/{Accounting,AccountsPayable,Assets,Attendance,Customers,Employees,Expenses,InterCompanyTransactions,Leave,Orders,Performance,Products,Projects,Recruitment,Suppliers,SupportTickets}.jsx`.

---

## Morise brand mark (31 August 2026)

The plain letter **"M"** that stood in for a brand mark in both apps is
replaced by a real **Morise logo**.

**The mark** — a geometric **monoline "M"** that also reads as an **upward
growth line** and a **route between points**, with an **amber diamond** on
its apex for the holding company as the **connecting keystone** of its
subsidiaries. Existing brand tokens only: navy `#1E3A5F`, amber `#D97706`,
white. One continuous stroke, round caps/joins — crisp from a 16 px favicon
up.

**`brand/`** (repo root, new) — `morise-logo.svg` (primary lockup: navy
tile + `MORISE` wordmark + `HOLDINGS LIMITED` subtitle),
`morise-logomark.svg` (navy app-tile), `morise-logomark-light.svg` /
`morise-logomark-dark.svg` (transparent "M" for dark / light grounds), and
`brand/README.md` — a one-page brand sheet (concept, colour values,
clear-space, minimum sizes, do / don't, file inventory).

**`src/components/Logo.jsx`** — one shared React component, **identical in
`frontend/` and `storefront/`**. The "M" stroke uses `currentColor`, so a
`<Logo/>` dropped into an existing badge (`.mark`, `.lmark`,
`.sf-brand-mark`, `.sf-login-mark`, `.mc-wordmark-mark`) inherits
navy-on-white or white-on-navy from that badge; the diamond is always
amber. Props: `size`, `tile` (standalone navy tile), `tone` (stroke
override).

**Wired in** — every former "M" placeholder now renders `<Logo/>`:

- **Admin** — `components/Layout.jsx` (top bar), `pages/Login.jsx`.
- **Storefront** — `components/Layout.jsx` (shop header),
  `components/CorporateLayout.jsx` (corporate nav),
  `components/DisclaimerGate.jsx` (full-page gate),
  `pages/{Login,Register,ForgotPassword,ResetPassword}.jsx`.
- Both `index.html` files gained an inline **SVG data-URI favicon** of the
  navy tile mark.

**No backend, permission, endpoint, schema or migration change** —
front-end assets + one shared component only; `openapi.json` unchanged.

**Verified**: `vite build` passes for **both** apps (73 modules each, no
new warnings); headless screenshots of the Admin login and the Storefront
disclaimer gate show the mark rendering correctly on navy and on white.

**Files:** `brand/*.svg`, `brand/README.md`,
`frontend/src/components/Logo.jsx`, `storefront/src/components/Logo.jsx`,
`frontend/src/components/Layout.jsx`, `frontend/src/pages/Login.jsx`,
`frontend/index.html`, `storefront/src/components/{Layout,CorporateLayout,DisclaimerGate}.jsx`,
`storefront/src/pages/{Login,Register,ForgotPassword,ResetPassword}.jsx`,
`storefront/index.html`.

---

## Morise banner family (31 August 2026)

A full set of professional **banners** on the logo's visual language —
navy → blue gradient, the logomark "M" as a faint watermark, the amber
keystone diamond, a thin **route line** through nodes.

**`brand/banners/`** (repo root, new) — **13 standalone SVGs** (no web
fonts, no external refs; a system sans stack in `<text>`):

| File | Size | Text | Use |
|------|------|------|-----|
| `group-hero.svg` | 1600×520 | baked | Standalone group hero (share / print / slide) |
| `group-hero-bg.svg` | 1600×520 | — | Texture behind live HTML hero copy |
| `page-header-bg.svg` | 1600×200 | — | Slim interior-page header band |
| `social-card.svg` | 1200×630 | baked | Open Graph / Twitter / LinkedIn |
| `email-header.svg` | 1200×280 | baked | Newsletter / email header |
| `promo-strip.svg` | 1600×200 | baked | Storefront promotional strip |
| `announcement-ribbon.svg` | 1600×56 | baked | "Demonstration build" notice |
| `auth-side.svg` | 960×1200 | baked | Sign-in / register brand panel |
| `subsidiary-agro.svg` | 1600×420 | baked | Morise Agro Ltd (green accent) |
| `subsidiary-logistics.svg` | 1600×420 | baked | Morise Logistics Ltd (sky accent) |
| `subsidiary-clearing-forwarding.svg` | 1600×420 | baked | Morise Clearing & Forwarding Ltd (violet) |
| `subsidiary-warehouse.svg` | 1600×420 | baked | Morise Warehouse Management Ltd (teal) |
| `subsidiary-collateral.svg` | 1600×420 | baked | Morise Collateral Management Ltd (rose) |

**Wired in** (front-end assets + minor CSS):

- The SVGs are mirrored into `frontend/public/brand/banners/` and
  `storefront/public/brand/banners/`, served at `/brand/banners/<name>.svg`.
- `storefront/src/styles/storefront.css` `.sf-hero` and
  `storefront/src/styles/corporate.css` `.mc-hero` now layer
  `group-hero-bg.svg` over the navy→blue gradient (gradient kept as a
  graceful fallback).
- `frontend/index.html` and `storefront/index.html` gained
  `description` + Open Graph / Twitter-card meta pointing at
  `social-card.svg`.

**Seed (seed-only, idempotent guards)** — `backend/prisma/seed.ts`: the
storefront promo-banner rail for the demo customer's company (Morise Agro
Ltd) is now a curated set of **three** text-only `PromoBanner` rows
("Season stock-up", "One storefront for the whole group", "Bulk fuel and
haulage, booked online"), consumed by the existing unchanged
`GET /customer-portal/promo-banners`.

**No backend, permission, endpoint, schema or migration change** —
`openapi.json` unchanged. Both `vite build`s pass; the backend seed
type-checks; the assets return `200` at `/brand/banners/…` on both dev
servers.

**Files:** `brand/banners/*.svg`, `brand/README.md` (Banners section),
`frontend/public/brand/banners/*`, `storefront/public/brand/banners/*`,
`storefront/src/styles/{storefront,corporate}.css`,
`frontend/index.html`, `storefront/index.html`,
`backend/prisma/seed.ts` (promo-banner rail).

### Banners on the storefront (31 August 2026)

The banner family is now **displayed on-screen** across the customer
storefront, not just wired behind the heroes.

- **`storefront/src/lib/corporate.js`** — `bannerFor(name)` maps a
  subsidiary name → `/brand/banners/subsidiary-*.svg` (group hero as the
  fallback); `GROUP_HERO_BANNER` / `PROMO_STRIP_BANNER` constants.
- **Public site** — `pages/corporate/Home.jsx` (Companies grid) and
  `pages/corporate/Companies.jsx` render each card's `.mc-co-photo` as the
  subsidiary's banner instead of an empty grey box;
  `pages/corporate/CompanyDetail.jsx` shows it as the `.mc-photo-strip`.
- **Signed-in storefront** — `pages/Subsidiaries.jsx` shows the group hero
  banner at the top and each subsidiary's banner on its card;
  `pages/Shop.jsx` shows the `promo-strip.svg` banner, swapped for the
  selected subsidiary's banner when the company filter is set.
- **CSS** — `.mc-co-photo` / `.mc-photo-strip` become `object-fit: cover`,
  left-anchored images; new `.sf-hero-banner` / `.sf-shop-banner` /
  `.sf-sub-banner` classes.
- The admin-managed **text** `PromoBanner` rail on the signed-in home was
  already displayed and is unchanged.

**Storefront front-end only** — no backend, permission, endpoint, schema
or migration change; `openapi.json` unchanged. The storefront builds; the
admin build is unaffected.

**Files:** `storefront/src/lib/corporate.js`,
`storefront/src/pages/{Subsidiaries,Shop}.jsx`,
`storefront/src/pages/corporate/{Home,Companies,CompanyDetail}.jsx`,
`storefront/src/styles/{storefront,corporate}.css`.
