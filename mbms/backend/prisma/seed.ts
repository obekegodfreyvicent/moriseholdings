/**
 * Seeds:
 *  - the role/permission catalogue (Identity Service tables are seeded at
 *    deployment per 08_Database Design Document, Section 14 — not left for
 *    manual entry)
 *  - the Morise Holdings Limited group structure, using the verified facts
 *    from the Board Resolution (registered location: Kira, Mulawa, Wakiso
 *    District; currency UGX) plus illustrative subsidiaries matching the
 *    Administrator mockups (Morise Agro Ltd, Morise Logistics Ltd)
 *  - eight demo users: Okurut Mathias (Managing Director, group-wide scope),
 *    Obeke Godfrey (IT Administrator, group-wide scope), Peter Kintu (Branch
 *    Manager scoped only to Morise Agro Ltd, demonstrating BR-01 scoping),
 *    Mary Nakato (HR Manager, scoped to Morise Logistics Ltd), Alan Smith
 *    (Finance Manager, scoped to Morise Agro Ltd), Grace Namono (Sales
 *    Manager, scoped to Morise Agro Ltd) and Tom Okello (Procurement
 *    Manager, scoped to Morise Agro Ltd), and Susan Nassuna (Auditor,
 *    read-only, group-wide) — matching the personas already used in the
 *    Administrator mockups for continuity where one exists
 *  - starter employee, accounting, customer and supplier data for Morise
 *    Agro Ltd, so the Employees, Accounting, Customers, Suppliers and
 *    Dashboard screens aren't empty on first login
 *
 * DEV-ONLY: seeded passwords are for local demonstration and must never be
 * used in a real deployment.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Passw0rd!23';

// Role catalogue from 04_Software Requirements Specification, Section 2.3
// (mirrored in morise.docx, Section 4 "Possible Roles").
const ROLE_CATALOGUE = [
  'Super Administrator',
  'Group CEO',
  'Managing Director',
  'Chief Financial Officer',
  'Finance Manager',
  'Accountant',
  'Auditor',
  'Human Resources Manager',
  'Procurement Manager',
  'Operations Manager',
  'Sales Manager',
  'Branch Manager',
  'Project Manager',
  'Inventory Manager',
  'Warehouse Manager',
  'IT Administrator',
  'Legal Officer',
  'Customer Service Officer',
  'Employee',
  'External Auditor',
  'Board Member',
  'Investor',
  'Read-only User',
];

// Every permission carries a `domain` (identity | org | hr | finance |
// operations | governance). The delegated-administration model (27 August
// 2026) uses it: a Branch Manager may only delegate "operations" permissions
// (within their own branch scope), a Human Resources Manager only "hr"
// permissions (within their scope); the Managing Director and any holder of
// identity.user.manage may delegate every domain. See
// src/identity/delegation/delegation.rules.ts.
const PERMISSIONS = [
  { code: 'identity.user.manage', domain: 'identity', description: 'Create, edit, activate/deactivate, lock and assign roles/scopes to users.' },
  { code: 'identity.user.delegate', domain: 'identity', description: 'Grant and revoke roles and permissions to users, bounded by your own delegation authority (Managing Director: all; Branch Manager: operations, own branch; HR Manager: HR, own scope).' },
  { code: 'identity.role.view', domain: 'identity', description: 'View the role and permission catalogue.' },
  { code: 'organization.company.manage', domain: 'org', description: 'Create and edit companies, branches and departments.' },
  { code: 'organization.company.viewAll', domain: 'org', description: 'View every company group-wide, not only those in your own scope.' },
  { code: 'employee.manage', domain: 'hr', description: 'Create and edit employee records within your scope.' },
  { code: 'employee.viewAll', domain: 'hr', description: 'View employee records group-wide, not only those in your own scope.' },
  { code: 'employee.view.sensitive', domain: 'hr', description: 'View unmasked employee bank/tax fields (FR-USER-08).' },
  { code: 'accounting.manage', domain: 'finance', description: 'Create/edit chart of accounts, financial periods and journal entries; post journal entries.' },
  { code: 'accounting.viewAll', domain: 'finance', description: 'View accounting data and the accounting dashboard summary group-wide.' },
  { code: 'customer.manage', domain: 'operations', description: 'Create and edit customer records within your scope.' },
  { code: 'customer.viewAll', domain: 'operations', description: 'View customer records group-wide, not only those in your own scope.' },
  { code: 'supplier.manage', domain: 'operations', description: 'Create and edit supplier records within your scope, including blacklist/unblacklist.' },
  { code: 'supplier.viewAll', domain: 'operations', description: 'View supplier records group-wide, not only those in your own scope.' },
  { code: 'supplier.view.sensitive', domain: 'finance', description: 'View unmasked supplier bank account fields.' },
  { code: 'product.manage', domain: 'operations', description: 'Create and edit product/service records and categories within your scope.' },
  { code: 'product.viewAll', domain: 'operations', description: 'View product records group-wide, not only those in your own scope.' },
  // Marketing & Promos + CMS / Site Builder (28 August 2026).
  { code: 'marketing.manage', domain: 'operations', description: 'Create and edit storefront discount codes and promotional banners within your scope.' },
  { code: 'marketing.viewAll', domain: 'operations', description: 'View storefront discount codes and promotional banners group-wide, not only those in your own scope.' },
  { code: 'cms.manage', domain: 'governance', description: 'Create, edit, publish and unpublish storefront content pages (CMS / Site Builder).' },
  { code: 'cms.viewAll', domain: 'governance', description: 'View storefront content pages and their draft/published state.' },
  { code: 'audit.view', domain: 'governance', description: 'View the audit trail (FR-AUDIT-02) and the dashboard recent-activity widget (FR-DASH-04).' },
  // Sprint 9 (Phase 2: Expense Management). See mbms/README.md, "Sprint 9".
  { code: 'expense.create', domain: 'operations', description: 'Submit an expense claim for yourself (self-service).' },
  { code: 'expense.viewAll', domain: 'finance', description: 'View every expense claim group-wide, not only your own or ones awaiting your approval.' },
  { code: 'expense.approve.manager', domain: 'operations', description: 'Approve or reject a submitted expense claim at the manager step.' },
  { code: 'expense.approve.finance', domain: 'finance', description: 'Approve or reject a manager-approved claim at the finance step, and pay/post an approved claim to accounting.' },
  // Sprint 11 (Phase 2: Asset Management). See mbms/README.md, "Sprint 11".
  { code: 'asset.manage', domain: 'operations', description: 'Register, update and transfer assets, record depreciation and maintenance, and request disposal, within your scope.' },
  { code: 'asset.viewAll', domain: 'operations', description: 'View every asset group-wide, not only those in your own scope.' },
  { code: 'asset.approve.disposal', domain: 'finance', description: 'Approve a requested asset disposal (with inspection notes) and execute the disposal, posting the derecognition entry to accounting.' },
  // Sprint 12 (Phase 2: Project Management). See mbms/README.md, "Sprint 12".
  { code: 'project.manage', domain: 'operations', description: 'Register and update projects, manage team/tasks/milestones, and transition project status, within your scope.' },
  { code: 'project.viewAll', domain: 'operations', description: 'View every project group-wide, not only those in your own scope.' },
  // Company and Holdings Management deepening (morise.docx, Section 2).
  { code: 'organization.intercompany.manage', domain: 'org', description: 'Create and post inter-company transactions between two companies in the Group.' },
  { code: 'organization.intercompany.viewAll', domain: 'org', description: 'View every inter-company transaction, not only ones you created or posted.' },
  // HR Module deepening (19 August 2026): Recruitment, Attendance, Leave, Performance.
  { code: 'recruitment.manage', domain: 'hr', description: 'Create and edit job vacancies, applications, interviews and offers within your scope.' },
  { code: 'recruitment.approve', domain: 'hr', description: 'Approve a job vacancy for posting (draft/pending_approval -> open).' },
  { code: 'recruitment.viewAll', domain: 'hr', description: 'View every vacancy/application group-wide, not only those in your own scope.' },
  { code: 'attendance.manage', domain: 'hr', description: 'Record attendance on an employee\'s behalf, and manage shift definitions, within your scope.' },
  { code: 'attendance.viewAll', domain: 'hr', description: 'View attendance records group-wide, not only those in your own scope.' },
  { code: 'leave.manage', domain: 'hr', description: 'Manage leave balances and submit a leave application on an employee\'s behalf, within your scope.' },
  { code: 'leave.approve', domain: 'hr', description: 'Approve or reject a submitted leave application.' },
  { code: 'leave.viewAll', domain: 'hr', description: 'View every leave application group-wide, not only those in your own scope.' },
  { code: 'performance.manage', domain: 'hr', description: 'Create review cycles and objectives, and submit a manager assessment, within your scope.' },
  { code: 'performance.viewAll', domain: 'hr', description: 'View every performance review group-wide, not only those in your own scope.' },
  // Payroll (28 August 2026). Shift scheduling reuses attendance.manage /
  // attendance.viewAll (the same permission that already covers shift
  // definitions) so no new permission is added for it.
  { code: 'payroll.manage', domain: 'hr', description: 'Create payroll runs and request salary advances, within your scope.' },
  { code: 'payroll.approve', domain: 'hr', description: 'Approve a payroll run, mark it paid (posting it to the ledger), and approve or reject a salary advance.' },
  { code: 'payroll.viewAll', domain: 'hr', description: 'View every payroll run, payslip and salary advance group-wide, not only those in your own scope.' },
  // Sprint 16 (Customer Storefront) — staff side of the customer portal:
  // advancing an order through fulfillment, and replying to a support
  // ticket. The customer-facing side (place order, create ticket) needs no
  // staff permission at all, gated instead by the separate customer-jwt
  // guard.
  { code: 'sales.order.manage', domain: 'operations', description: 'View and advance customer orders through fulfillment (confirm/pack/dispatch/deliver/cancel), within your scope.' },
  { code: 'sales.order.viewAll', domain: 'operations', description: 'View every customer order group-wide, not only those in your own scope.' },
  { code: 'support.ticket.manage', domain: 'operations', description: 'View and reply to customer support tickets, within your scope.' },
  { code: 'support.ticket.viewAll', domain: 'operations', description: 'View every support ticket group-wide, not only those in your own scope.' },
  // Financial Module deepening (19 August 2026): Accounts Payable. AR reuses
  // accounting.manage/accounting.viewAll (credit/debit notes and staff
  // reporting are financial-oversight actions, the same class of action
  // those two permissions already gate) rather than adding AR-specific
  // codes — no new permission was needed there. AP is a new domain
  // (supplier invoice approval workflow) so it gets its own three, matching
  // the manage/approve/viewAll shape expense.*/asset.* already established.
  { code: 'ap.manage', domain: 'finance', description: 'Create supplier invoices, record supplier payments and credit notes, within your scope.' },
  { code: 'ap.approve', domain: 'finance', description: 'Approve a supplier invoice (pending_approval -> approved), posting it to the ledger.' },
  { code: 'ap.viewAll', domain: 'finance', description: 'View every supplier invoice/payment group-wide, not only those in your own scope.' },
  // Delivery (31 August 2026) — Morise Logistics Ltd dispatch. The
  // /api/v1/delivery API (src/delivery) was wired earlier but its two
  // permission codes had never been added to this catalogue or granted, so
  // every call returned 403. manage/viewAll shape, matching sales.order.*
  // and ap.* above. manage = create a delivery for a customer order,
  // assign/reassign a delivery persona (driver/courier), advance the
  // lifecycle, capture proof of delivery, and manage the driver pool.
  { code: 'delivery.manage', domain: 'operations', description: 'Create deliveries for customer orders, assign and reassign delivery personas (drivers/couriers), advance the delivery lifecycle, capture proof of delivery, and manage the Morise Logistics Ltd driver pool, within your scope.' },
  { code: 'delivery.viewAll', domain: 'operations', description: 'View every delivery, delivery persona and dispatch metric group-wide, not only those in your own scope.' },
];

// Sprint 1+2+3 (+ basic accounting/dashboard) wires permissions only for the
// roles this slice actually uses; every other catalogue role exists (so
// later sprints can assign it) but starts with no permissions.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Administrator': [
    'identity.user.manage',
    'identity.user.delegate',
    'identity.role.view',
    'organization.company.manage',
    'organization.company.viewAll',
    'employee.manage',
    'employee.viewAll',
    'employee.view.sensitive',
    'accounting.manage',
    'accounting.viewAll',
    'customer.manage',
    'customer.viewAll',
    'supplier.manage',
    'supplier.viewAll',
    'supplier.view.sensitive',
    'product.manage',
    'product.viewAll',
    // Marketing & Promos + CMS (28 August 2026) — same "everything" convention.
    'marketing.manage',
    'marketing.viewAll',
    'cms.manage',
    'cms.viewAll',
    'audit.view',
    // Sprint 9 (Expense Management) — Super Administrator gets every
    // expense permission, same "can do everything every other role can do"
    // convention already used for every earlier module.
    'expense.create',
    'expense.viewAll',
    'expense.approve.manager',
    'expense.approve.finance',
    // Sprint 11 (Asset Management) — same "everything" convention.
    'asset.manage',
    'asset.viewAll',
    'asset.approve.disposal',
    // Sprint 12 (Project Management) — same "everything" convention.
    'project.manage',
    'project.viewAll',
    // Company and Holdings Management deepening — same "everything" convention.
    'organization.intercompany.manage',
    'organization.intercompany.viewAll',
    // HR Module deepening — same "everything" convention.
    'recruitment.manage',
    'recruitment.approve',
    'recruitment.viewAll',
    'attendance.manage',
    'attendance.viewAll',
    'leave.manage',
    'leave.approve',
    'leave.viewAll',
    'performance.manage',
    'performance.viewAll',
    // Payroll (28 August 2026) — same "everything" convention.
    'payroll.manage',
    'payroll.approve',
    'payroll.viewAll',
    // Sprint 16 (Customer Storefront) — same "everything" convention.
    'sales.order.manage',
    'sales.order.viewAll',
    'support.ticket.manage',
    'support.ticket.viewAll',
    // Financial Module deepening — same "everything" convention.
    'ap.manage',
    'ap.approve',
    'ap.viewAll',
  ],
  'Managing Director': [
    // Full operational authority across every Admin category (30 August
    // 2026): the Managing Director asked to be able to operate — view,
    // create, edit, approve, execute — on every section of ADMIN / BACKEND,
    // HUMAN RESOURCES, MY HR and FINANCIAL & ACCOUNTING, not only to hold
    // group-wide *view*. This role therefore now carries the complete
    // permission catalogue (the same breadth as Super Administrator) plus
    // `identity.user.delegate` as the top grantor of the
    // delegated-administration model — consistent with "Managing Director:
    // all" already stated there, and with the subsidiary-lifecycle and
    // Marketing/CMS full-manage grants added earlier for the same reason.
    // MY HR needs no permission (it is scoped by Employee.userId).
    'identity.user.delegate',
    'identity.user.manage',
    'identity.role.view',
    'organization.company.manage',
    'organization.company.viewAll',
    'organization.intercompany.manage',
    'organization.intercompany.viewAll',
    'employee.manage',
    'employee.viewAll',
    'employee.view.sensitive',
    'accounting.manage',
    'accounting.viewAll',
    'customer.manage',
    'customer.viewAll',
    'supplier.manage',
    'supplier.viewAll',
    'supplier.view.sensitive',
    'product.manage',
    'product.viewAll',
    'marketing.manage',
    'marketing.viewAll',
    'cms.manage',
    'cms.viewAll',
    'audit.view',
    'expense.create',
    'expense.viewAll',
    'expense.approve.manager',
    'expense.approve.finance',
    'asset.manage',
    'asset.viewAll',
    'asset.approve.disposal',
    'project.manage',
    'project.viewAll',
    'recruitment.manage',
    'recruitment.approve',
    'recruitment.viewAll',
    'attendance.manage',
    'attendance.viewAll',
    'leave.manage',
    'leave.approve',
    'leave.viewAll',
    'performance.manage',
    'performance.viewAll',
    'payroll.manage',
    'payroll.approve',
    'payroll.viewAll',
    'sales.order.manage',
    'sales.order.viewAll',
    'support.ticket.manage',
    'support.ticket.viewAll',
    'ap.manage',
    'ap.approve',
    'ap.viewAll',
  ],
  'Group CEO': [
    'identity.role.view',
    'organization.company.viewAll',
    'employee.viewAll',
    'accounting.viewAll',
    'customer.viewAll',
    'supplier.viewAll',
    'product.viewAll',
    'audit.view',
    'expense.create',
    'expense.viewAll',
    'asset.viewAll',
    'project.viewAll',
    'organization.intercompany.viewAll',
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    'sales.order.viewAll',
    'support.ticket.viewAll',
    'ap.viewAll',
  ],
  'IT Administrator': [
    'identity.user.manage',
    'identity.role.view',
    'organization.company.viewAll',
    // Sprint 2 verification: no seeded demo user held this before, so
    // FR-COMP-01/02/04/08's create/edit actions were never actually
    // reachable through the demo — IT Administrator is the closest
    // "Super Administrator"-like persona seeded, so it picks this up too.
    'organization.company.manage',
    'expense.create',
    // Sprint 16 (Customer Storefront): same demo-reachability reasoning as
    // above — no seeded demo user holds Customer Service Officer (the
    // natural fit for support.ticket.manage), so IT Administrator, the
    // seeded "closest to Super Administrator" persona, picks this up too,
    // rather than leaving the staff Support Tickets screen unreachable in
    // the demo entirely. Also needs support.ticket.viewAll: IT
    // Administrator's own UserScope row is the root holding company (no
    // tickets ever post there — only subsidiaries like Morise Agro Ltd
    // do), so without group-wide visibility here the manage grant above
    // would be unreachable too, the same class of gap Sprint 8's Alpha
    // pass already documented for filter[companyId] scope checks.
    'support.ticket.manage',
    'support.ticket.viewAll',
    // Payroll (28 August 2026): same demo-reachability reasoning — the
    // seeded "closest to Super Administrator" persona picks up full
    // payroll so the run / approve / pay flow is exercisable end to end.
    'payroll.manage',
    'payroll.approve',
    'payroll.viewAll',
    // Marketing & Promos + CMS (28 August 2026): same demo-reachability
    // reasoning as support.ticket.manage / organization.company.manage above
    // — IT Administrator is the seeded "closest to Super Administrator"
    // persona, so it picks up full management of the two new storefront
    // admin sections rather than leaving them unreachable in the demo.
    'marketing.manage',
    'marketing.viewAll',
    'cms.manage',
    'cms.viewAll',
  ],
  // Sprint 9: Branch Manager (Kintu's demo persona) previously held no
  // permissions at all — only company/branch scope, used to demonstrate
  // BR-01 scoping without any write access. Expense claims are the first
  // capability a Branch Manager persona needs: submitting their own claims,
  // and approving direct reports' claims at the manager step, which is what
  // a branch-level manager role should plausibly do.
  // HR Module deepening: leave.approve is added to every role that already
  // holds expense.approve.manager — the same line-manager-approval
  // reasoning already established for that permission, extended to leave
  // requests rather than treated as a separate access decision.
  // Sprint 16: order fulfillment (confirm/pack/dispatch/deliver) is a
  // branch-level physical operation — the same "closest existing role to
  // the real-world job function" reasoning already used throughout the RBAC
  // completion pass, below.
  // Delegated-administration model (27 August 2026): Branch Manager may
  // delegate "operations"-domain permissions to users inside their own
  // branch scope (enforced in src/identity/delegation), plus the leave
  // approval and order fulfilment it already held.
  'Branch Manager': [
    'identity.user.delegate',
    'expense.create',
    'expense.approve.manager',
    'leave.approve',
    'sales.order.manage',
  ],
  'Human Resources Manager': [
    // Delegated-administration model (27 August 2026): HR Manager may
    // delegate "hr"-domain permissions within their own company/branch scope.
    'identity.user.delegate',
    'employee.manage',
    'employee.view.sensitive',
    'expense.create',
    'expense.approve.manager',
    // HR Module deepening: Human Resources Manager owns the whole HR
    // module operationally — Recruitment, Attendance and Leave day-to-day
    // management, plus Performance cycle administration. viewAll on each
    // is included since HR needs group-wide visibility into its own
    // function, the same reasoning Finance Manager already has for
    // accounting.manage/viewAll together.
    'recruitment.manage',
    'recruitment.viewAll',
    'attendance.manage',
    'attendance.viewAll',
    'leave.manage',
    'leave.approve',
    'leave.viewAll',
    'performance.manage',
    'performance.viewAll',
    // Payroll (28 August 2026): the HR Manager owns the payroll module
    // operationally (prepares the run, manages salary advances), the same
    // "owns the HR module" reasoning as recruitment.manage / leave.manage
    // above. Approval and payment sit with Managing Director / Finance
    // Manager, mirroring the split already used for expenses.
    'payroll.manage',
    'payroll.viewAll',
  ],
  // Sprint 11: Finance Manager holds asset.manage (registration/
  // depreciation/maintenance are financial record-keeping, same reasoning
  // as accounting.manage) plus asset.approve.disposal (disposal has direct
  // ledger impact, the same reasoning that already gave this role
  // expense.approve.finance).
  // Sprint 12: Finance Manager holds project.manage — budget allocation and
  // profitability review are financial record-keeping, the same reasoning
  // already given for accounting.manage and asset.manage.
  // Payroll (28 August 2026): Finance Manager approves and pays a payroll
  // run (it posts to the ledger — the same direct-ledger-impact reasoning
  // that already gave this role expense.approve.finance and
  // asset.approve.disposal), plus payroll oversight.
  'Finance Manager': ['accounting.manage', 'expense.create', 'expense.approve.finance', 'asset.manage', 'asset.approve.disposal', 'project.manage', 'project.viewAll', 'organization.intercompany.manage', 'organization.intercompany.viewAll', 'ap.manage', 'ap.viewAll', 'payroll.approve', 'payroll.viewAll'],
  // Marketing & Promos (28 August 2026): discount codes and storefront
  // promos are a sales function — Sales Manager is the most direct match of
  // any seeded role, mirroring how it already holds product.manage and
  // sales.order.manage for the same reasoning.
  'Sales Manager': ['customer.manage', 'product.manage', 'marketing.manage', 'marketing.viewAll', 'expense.create', 'expense.approve.manager', 'leave.approve', 'sales.order.manage'],
  // Sprint 11: Procurement Manager holds asset.manage — 05_Business Process
  // Document, Section 6.5's own workflow starts asset registration from
  // "Purchase Approved (via Procurement Workflow)", making Procurement the
  // most direct match of any seeded role for asset registration itself.
  // Financial Module deepening: Procurement Manager holds ap.manage (not
  // ap.approve/viewAll) — the same "receives the goods/services, enters the
  // invoice" reasoning already given for asset.manage above; financial
  // approval and ledger posting stay with Finance Manager/Managing
  // Director.
  'Procurement Manager': ['supplier.manage', 'supplier.view.sensitive', 'product.manage', 'expense.create', 'expense.approve.manager', 'asset.manage', 'leave.approve', 'ap.manage'],
  // SRS Section 2.3: "Auditor / External Auditor — Active — read-only access
  // to audit trail and ledger". No accounting.viewAll here deliberately —
  // an Auditor can see the audit trail itself, not edit the ledger; ledger
  // *read* access beyond the audit trail is a separate, still-open
  // permission decision this proof-of-concept doesn't need to resolve yet.
  // expense.viewAll added for Sprint 9 and asset.viewAll for Sprint 11 for
  // the same reason: an Auditor needs cross-company read access for the
  // same oversight reason Audit Trail scope was left group-wide (README,
  // "Judgment calls", item 6) — neither grants any create/approve/pay
  // permission, so the role stays read-only.
  Auditor: [
    'audit.view',
    'expense.viewAll',
    'asset.viewAll',
    'project.viewAll',
    'organization.intercompany.viewAll',
    // HR Module deepening: same cross-company oversight-read reasoning
    // already given for every other module's viewAll grant on this role.
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    'sales.order.viewAll',
    'support.ticket.viewAll',
    'ap.viewAll',
  ],

  // RBAC completion pass (19 August 2026): 14 of the 23 catalogue roles
  // above had existed since Sprint 1 (upserted so later sprints could
  // assign them) but were never given a single permission — "roles that
  // exist but can do nothing," the same class of demo-reachability gap
  // Sprint 2 found for company management. This pass reasons out a
  // permission set for every one of them from their real-world job
  // function, mapped onto the permission catalogue that already exists —
  // no role here gets a permission a real holder of that title wouldn't
  // plausibly need, and none gets create/approve authority beyond what
  // its seniority implies.

  // A financial executive, senior to Finance Manager (mirrors that role's
  // manage-level financial authority) with the Group-level oversight
  // breadth Managing Director/Group CEO already hold for non-financial
  // domains — matching how a CFO sits above Finance but still needs
  // visibility across the business to do the job.
  'Chief Financial Officer': [
    'identity.role.view',
    'organization.company.viewAll',
    'employee.viewAll',
    'accounting.manage',
    'accounting.viewAll',
    'customer.viewAll',
    'supplier.viewAll',
    'product.viewAll',
    'audit.view',
    'expense.create',
    'expense.viewAll',
    'expense.approve.finance',
    'asset.manage',
    'asset.viewAll',
    'asset.approve.disposal',
    'project.viewAll',
    'organization.intercompany.manage',
    'organization.intercompany.viewAll',
    // HR Module deepening: Group-level financial-executive oversight
    // breadth, same reasoning as every other viewAll on this role.
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    // Financial Module deepening: same Group-level financial-executive
    // reasoning as accounting.manage/viewAll above.
    'ap.manage',
    'ap.viewAll',
  ],
  // Operational bookkeeping staff reporting to Finance Manager/CFO —
  // day-to-day ledger entries, deliberately no approval-step or
  // group-wide oversight permission, matching the seniority gap between
  // "Accountant" and "Finance Manager" in a real finance department.
  Accountant: ['accounting.manage', 'expense.create'],
  // A generalist operational lead, not finance-specific — headcount,
  // customer/supplier relationships and day-to-day product/project
  // execution, the same breadth Sales Manager and Procurement Manager
  // each get for their own narrower domain.
  'Operations Manager': ['employee.manage', 'customer.viewAll', 'supplier.viewAll', 'product.manage', 'project.manage', 'expense.create', 'expense.approve.manager', 'leave.approve'],
  // A dedicated project-execution role, distinct from Managing Director's
  // project.manage (justified there as Group-level profitability
  // oversight, README "Sprint 12") — this is the actual hands-on project
  // lead: full project management plus manager-step expense approval for
  // their own team's claims.
  'Project Manager': ['project.manage', 'project.viewAll', 'expense.create', 'expense.approve.manager', 'leave.approve'],
  // No Inventory module exists in this codebase (deliberately deferred
  // since Sprint 8 — see mbms/README.md). Product records are the
  // closest existing analog (categories/units/barcodes), so Inventory
  // Manager is granted product.manage/viewAll as a stand-in; this role
  // should gain dedicated inventory.* permissions once that module is
  // actually built, not before.
  'Inventory Manager': ['product.manage', 'product.viewAll', 'expense.create', 'leave.approve'],
  // Same Inventory-module gap as above. Warehouse Manager additionally
  // gets asset.manage — physical custody of equipment/fixtures in a
  // warehouse is the closest thing this codebase actually models to a
  // warehouse operation.
  'Warehouse Manager': ['product.viewAll', 'asset.manage', 'expense.create', 'leave.approve'],
  // Compliance/contracts oversight: supplier contract references
  // (FR-SUPP-02), employee contract terms, corporate structure and audit
  // trail visibility — no create/manage permission anywhere, matching an
  // advisory/oversight function rather than an operational one.
  'Legal Officer': ['identity.role.view', 'organization.company.viewAll', 'employee.viewAll', 'supplier.viewAll', 'audit.view'],
  // Front-line customer support — create/edit customer records within
  // their own scope (BR-01), deliberately not customer.viewAll (no
  // group-wide need for this role).
  // Sprint 16: support ticket handling is this role's most direct match of
  // any seeded role for the storefront's "Support" screen — the same
  // reasoning already given for this role's customer.manage grant.
  'Customer Service Officer': ['customer.manage', 'expense.create', 'support.ticket.manage'],
  // The generic "regular staff member" role — deliberately minimal:
  // self-service expense claim submission only, nothing else. Every
  // elevated capability in this system requires a specific role above
  // this one; Employee is the floor, not a default bundle of access.
  Employee: ['expense.create'],
  // 04_Software Requirements Specification, Section 2.3 groups "Auditor /
  // External Auditor" on one line ("read-only access to audit trail and
  // ledger") — mirrored here exactly rather than re-derived, since the
  // source document itself treats them as one access level under two
  // titles (internal vs. externally engaged).
  'External Auditor': [
    'audit.view',
    'expense.viewAll',
    'asset.viewAll',
    'project.viewAll',
    'organization.intercompany.viewAll',
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    'ap.viewAll',
  ],
  // Governance oversight: every *.viewAll permission across the business,
  // zero create/manage/approve rights anywhere — deliberately narrower
  // than Group CEO (an operating executive who also holds expense.create)
  // since a Board Member's relationship to this system is oversight, not
  // day-to-day operation.
  'Board Member': [
    'identity.role.view',
    'organization.company.viewAll',
    'employee.viewAll',
    'accounting.viewAll',
    'customer.viewAll',
    'supplier.viewAll',
    'product.viewAll',
    'audit.view',
    'expense.viewAll',
    'asset.viewAll',
    'project.viewAll',
    'organization.intercompany.viewAll',
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    'ap.viewAll',
  ],
  // An external stakeholder whose interest in this system is strictly
  // financial performance, not operational detail — deliberately narrower
  // than Board Member (no employee/customer/supplier/product/audit/asset/
  // project visibility at all, just the numbers).
  Investor: ['organization.company.viewAll', 'accounting.viewAll'],
  // A generic "see everything, change nothing" role: every *.viewAll
  // permission that exists, but neither employee.view.sensitive nor
  // supplier.view.sensitive — "read-only" should not imply seeing masked
  // bank/tax fields unmasked; that stays a deliberately separate grant.
  'Read-only User': [
    'identity.role.view',
    'organization.company.viewAll',
    'employee.viewAll',
    'accounting.viewAll',
    'customer.viewAll',
    'supplier.viewAll',
    'product.viewAll',
    'audit.view',
    'expense.viewAll',
    'asset.viewAll',
    'project.viewAll',
    'organization.intercompany.viewAll',
    'recruitment.viewAll',
    'attendance.viewAll',
    'leave.viewAll',
    'performance.viewAll',
    'ap.viewAll',
  ],
};

// Delivery module activation (31 August 2026). The delivery.* codes are in
// the catalogue above; grant them here so the dispatch API is reachable
// (assign a Morise Logistics Ltd delivery persona to a customer's order).
// - manage + viewAll: the "everything" roles (Super Administrator, Managing
//   Director) and IT Administrator (the seeded "closest to Super
//   Administrator" persona — same demo-reachability reasoning already used
//   for support.ticket.*, marketing.*, cms.* and payroll.*: deliveries
//   live in subsidiaries, so the manage grant needs group-wide visibility
//   to be exercisable) and Operations Manager (a generalist operational
//   lead — dispatch is an operations function, the same match reasoning
//   that gave this role product.manage / project.manage).
// - manage only, own scope: Branch Manager — a branch-level physical
//   operation, the same reasoning that already gave it sales.order.manage.
// - viewAll only: the oversight roles that collect every *.viewAll.
for (const r of ['Super Administrator', 'Managing Director', 'IT Administrator', 'Operations Manager']) {
  ROLE_PERMISSIONS[r].push('delivery.manage', 'delivery.viewAll');
}
ROLE_PERMISSIONS['Branch Manager'].push('delivery.manage');
for (const r of ['Group CEO', 'Auditor', 'External Auditor', 'Board Member', 'Read-only User']) {
  ROLE_PERMISSIONS[r].push('delivery.viewAll');
}

async function main() {
  console.log('Seeding roles and permissions...');
  const permissionsByCode = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, domain: (p as { domain?: string }).domain ?? 'general' },
      create: p,
    });
    permissionsByCode.set(row.code, row.id);
  }

  const rolesByName = new Map<string, string>();
  for (const name of ROLE_CATALOGUE) {
    const row = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystemRole: true },
    });
    rolesByName.set(name, row.id);
  }

  for (const [roleName, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = rolesByName.get(roleName)!;
    for (const code of codes) {
      const permissionId = permissionsByCode.get(code)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  console.log('Seeding Morise Holdings Limited group structure...');
  const holding = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000001',
      parentCompanyId: null,
      name: 'Morise Holdings Limited',
      address: 'Kira, Mulawa, Wakiso District, Uganda',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  const agro = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000002',
      parentCompanyId: holding.id,
      // Sprint 13 fix: FR-COMP-03 requires a relationshipType on every
      // non-root company, added in Sprint 2 — this seed's two subsidiaries
      // were both created before that requirement's field existed on this
      // seed and were never backfilled, so they carried a silently-null
      // relationshipType until the new company/branch report surfaced it
      // (falling back to a misleading "holding" label for genuine
      // subsidiaries). Both are wholly-owned subsidiaries in the Board
      // Resolution's own group structure.
      relationshipType: 'subsidiary',
      ownershipPercent: 100,
      name: 'Morise Agro Ltd',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  const logistics = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000003',
      parentCompanyId: holding.id,
      relationshipType: 'subsidiary', // Sprint 13 fix — see the identical note on Morise Agro Ltd, above.
      ownershipPercent: 100,
      name: 'Morise Logistics Ltd',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  await prisma.branch.upsert({
    where: { id: 'b1000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: 'b1000000-0000-4000-8000-000000000001', companyId: agro.id, name: 'Kira HQ' },
  });
  await prisma.branch.upsert({
    where: { id: 'b1000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: 'b1000000-0000-4000-8000-000000000002', companyId: agro.id, name: 'Mbale Branch' },
  });
  await prisma.branch.upsert({
    where: { id: 'b1000000-0000-4000-8000-000000000003' },
    update: {},
    create: { id: 'b1000000-0000-4000-8000-000000000003', companyId: logistics.id, name: 'Jinja Branch' },
  });

  // ------------------------------------------------------------------
  // Clearing, Forwarding & Logistics subsidiary (27 August 2026)
  // ------------------------------------------------------------------
  // The Managing Director created a new wholly-owned subsidiary for the
  // Group's clearing/forwarding/logistics line of business (Air/Ocean/Road
  // freight, customs clearance, export facilitation, warehousing), operating
  // across Uganda's main border posts and Entebbe Airport. Its multi-module
  // system is specified in docx/19_Clearing, Forwarding & Logistics System —
  // Feature Specification and slated as a future phase; the org structure
  // (company, branches, departments, starter policies) is seeded here so it
  // is a real, manageable subsidiary from day one.
  const clearingFwd = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000004' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000004',
      parentCompanyId: holding.id,
      relationshipType: 'subsidiary',
      ownershipPercent: 100,
      name: 'Morise Clearing & Forwarding Ltd',
      address: 'Plot 12, Clement Hill Road, Kampala, Uganda',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  const cfBranches = [
    ['b1000000-0000-4000-8000-000000000010', 'Kampala HQ', 'Plot 12, Clement Hill Road, Kampala'],
    ['b1000000-0000-4000-8000-000000000011', 'Malaba Border Office', 'Malaba, Tororo District'],
    ['b1000000-0000-4000-8000-000000000012', 'Busia Border Office', 'Busia Town, Busia District'],
    ['b1000000-0000-4000-8000-000000000013', 'Entebbe Airport Office', 'Entebbe International Airport Cargo Centre'],
    ['b1000000-0000-4000-8000-000000000014', 'Mutukula Border Office', 'Mutukula, Kyotera District'],
    ['b1000000-0000-4000-8000-000000000015', 'Elegu Border Office', 'Elegu, Amuru District'],
  ] as const;
  for (const [id, name, address] of cfBranches) {
    await prisma.branch.upsert({
      where: { id },
      update: {},
      create: { id, companyId: clearingFwd.id, name, address },
    });
  }

  const cfDepartments = [
    ['d1000000-0000-4000-8000-000000000010', 'Customs Clearance', 'ASYCUDA declarations, duty/tax computation, URA payment reconciliation, inspections (UNBS/PVOC).'],
    ['d1000000-0000-4000-8000-000000000011', 'Freight Forwarding', 'Air/Ocean/Road bookings, carrier & rate management, B/L and AWB, transit documents (T1, RCTG).'],
    ['d1000000-0000-4000-8000-000000000012', 'Warehousing', 'Bonded and non-bonded stores, GRN/GDN, bin/location management, storage billing.'],
    ['d1000000-0000-4000-8000-000000000013', 'Logistics & Supply Chain', 'Multi-modal planning, distribution and last-mile scheduling, route/cost optimisation, POD.'],
    ['d1000000-0000-4000-8000-000000000014', 'Export Facilitation', 'Export declarations, permits, Certificate of Origin (EAC/COMESA), pre-shipment inspection.'],
    ['d1000000-0000-4000-8000-000000000015', 'Fleet Management', 'Own and subcontracted trucks, GPS tracking, driver licences and trip logs.'],
    ['d1000000-0000-4000-8000-000000000016', 'Client Services', 'Onboarding & KYC, quotations, the client portal, complaints/ticketing, notifications.'],
    ['d1000000-0000-4000-8000-000000000017', 'Finance & Billing', 'Job costing, per-job/consolidated invoicing, disbursements to URA/port/transporters, multi-currency.'],
  ] as const;
  for (const [id, name, description] of cfDepartments) {
    await prisma.department.upsert({
      where: { id },
      update: {},
      create: { id, companyId: clearingFwd.id, name, description },
    });
  }
  // Its starter policies are seeded further down, once the MD user exists
  // (CompanyPolicy.createdBy is required).

  // ------------------------------------------------------------------
  // Warehouse Management subsidiary (27 August 2026)
  // ------------------------------------------------------------------
  // A second subsidiary the Managing Director set up: multi-branch warehouse
  // operations across Uganda (Kampala, Jinja, Mbarara, Gulu, Mbale). Its
  // multi-module Warehouse Management System is specified in
  // docx/20_Warehouse Management System (WMS) — Feature Specification and
  // slated as a future phase; the org structure is seeded here so it is a
  // real, manageable subsidiary from day one.
  const warehousing = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000005' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000005',
      parentCompanyId: holding.id,
      relationshipType: 'subsidiary',
      ownershipPercent: 100,
      name: 'Morise Warehouse Management Ltd',
      address: 'Plot 45, Sixth Street, Industrial Area, Kampala, Uganda',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  const wmsBranches = [
    ['b1000000-0000-4000-8000-000000000020', 'Kampala Central Warehouse', 'Plot 45, Sixth Street, Industrial Area, Kampala'],
    ['b1000000-0000-4000-8000-000000000021', 'Jinja Warehouse', 'Main Street Industrial Zone, Jinja'],
    ['b1000000-0000-4000-8000-000000000022', 'Mbarara Warehouse', 'High Street, Mbarara'],
    ['b1000000-0000-4000-8000-000000000023', 'Gulu Warehouse', 'Gulu-Kampala Road, Gulu'],
    ['b1000000-0000-4000-8000-000000000024', 'Mbale Warehouse', 'Republic Street, Mbale'],
  ] as const;
  for (const [id, name, address] of wmsBranches) {
    await prisma.branch.upsert({
      where: { id },
      update: {},
      create: { id, companyId: warehousing.id, name, address },
    });
  }

  const wmsDepartments = [
    ['d1000000-0000-4000-8000-000000000020', 'Branch Operations', 'Centralised branch dashboard, inter-branch transfers, branch performance comparison, shift management.'],
    ['d1000000-0000-4000-8000-000000000021', 'Inventory Control', 'Real-time stock, batch/lot and serial tracking, multi-UOM, cycle counting, ABC analysis, reorder alerts.'],
    ['d1000000-0000-4000-8000-000000000022', 'Receiving & Putaway', 'GRN generation, barcode/QR scanning, QC checks, system-directed putaway, cross-docking.'],
    ['d1000000-0000-4000-8000-000000000023', 'Order Fulfilment', 'Wave/batch/zone picking, packing & kitting, shipping manifests, carrier integration.'],
    ['d1000000-0000-4000-8000-000000000024', 'Yard & Dock', 'Dock-door scheduling, yard inventory, vehicle check-in/out.'],
    ['d1000000-0000-4000-8000-000000000025', 'Reporting & BI', 'Stock aging, expiry tracking, space-utilisation heat maps, staff productivity, branch P&L, custom report builder.'],
    ['d1000000-0000-4000-8000-000000000026', 'IT & Integrations', 'ERP/accounting/e-commerce/biometric integrations, offline mode, EFRIS, mobile money.'],
    ['d1000000-0000-4000-8000-000000000027', 'Compliance & Security', 'Audit trails, encryption, 2FA, backup/DR, Data Protection and Privacy Act 2019 compliance.'],
    ['d1000000-0000-4000-8000-000000000028', 'Field & Mobile Operations', 'Warehouse app, photo capture, GPS tracking, e-signature POD, on-site label printing.'],
  ] as const;
  for (const [id, name, description] of wmsDepartments) {
    await prisma.department.upsert({
      where: { id },
      update: {},
      create: { id, companyId: warehousing.id, name, description },
    });
  }
  // WMS starter policies are seeded further down, next to the C&F ones.

  // ------------------------------------------------------------------
  // Collateral Management subsidiary (30 August 2026)
  // ------------------------------------------------------------------
  // A third specification-stage subsidiary the Managing Director set up:
  // Morise Collateral Management Ltd acts as a Collateral Management Agent
  // (CMA), monitoring physical goods pledged as collateral across client
  // sites (warehouses, silos, tank farms, yards, cold stores) for banks and
  // financiers. Its Multi-Site Collateral Management System is specified in
  // docx/21_Multi-Site Collateral Management System — Feature Specification
  // and slated as a future phase; the org structure (company, sites,
  // departments, starter policies) is seeded here so it is a real,
  // manageable subsidiary from day one under the subsidiary-lifecycle
  // capability.
  const collateral = await prisma.company.upsert({
    where: { id: 'a1000000-0000-4000-8000-000000000006' },
    update: {},
    create: {
      id: 'a1000000-0000-4000-8000-000000000006',
      parentCompanyId: holding.id,
      relationshipType: 'subsidiary',
      ownershipPercent: 100,
      name: 'Morise Collateral Management Ltd',
      address: 'Plot 7, Kyadondo Road, Nakasero, Kampala, Uganda',
      currency: 'UGX',
      financialYearStart: new Date('2026-01-01'),
    },
  });

  // "Branches" model the head-office console plus the client sites the CMA
  // monitors — the same Branch record the rest of MBMS scopes by.
  const cmsBranches = [
    ['b1000000-0000-4000-8000-000000000030', 'Kampala Head Office', 'Plot 7, Kyadondo Road, Nakasero, Kampala'],
    ['b1000000-0000-4000-8000-000000000031', 'Jinja Grain Silos Site', 'Masese Industrial Area, Jinja'],
    ['b1000000-0000-4000-8000-000000000032', 'Mbale Warehouse Site', 'Industrial Division, Mbale'],
    ['b1000000-0000-4000-8000-000000000033', 'Masindi Grain Store Site', 'Masindi–Hoima Road, Masindi'],
    ['b1000000-0000-4000-8000-000000000034', 'Kasese Cold Store Site', 'Nyamwamba Division, Kasese'],
    ['b1000000-0000-4000-8000-000000000035', 'Buikwe Tank Farm Site', 'Njeru, Buikwe District'],
  ] as const;
  for (const [id, name, address] of cmsBranches) {
    await prisma.branch.upsert({
      where: { id },
      update: {},
      create: { id, companyId: collateral.id, name, address },
    });
  }

  const cmsDepartments = [
    ['d1000000-0000-4000-8000-000000000030', 'Field Inspection', 'GPS-verified site visits, configurable checklists by commodity, tamper-evident photo/video evidence, digital stock counts, e-signature from site staff.'],
    ['d1000000-0000-4000-8000-000000000031', 'Site & Warehouse Management', 'Site registry with geofence boundaries, storage-type and capacity records, site status and risk classification, site document library.'],
    ['d1000000-0000-4000-8000-000000000032', 'Stock & Collateral Control', 'Real-time per-site stock ledger, intake/outtake movement workflows, weighbridge capture, valuation engine and coverage calculation, multi-client segregation.'],
    ['d1000000-0000-4000-8000-000000000033', 'Inspection & Audit', 'Scheduled / random / trigger-based inspections, variance detection against system stock, discrepancy reporting with root-cause and sign-off, second-inspector verification.'],
    ['d1000000-0000-4000-8000-000000000034', 'Release & Movement Authorization', 'Dual-control (maker–checker) release and substitution approval, lender OTP / e-signature confirmation, automatic coverage-threshold holds, chain-of-custody log.'],
    ['d1000000-0000-4000-8000-000000000035', 'Client & Lender Relations', 'Client and lender portal access, real-time coverage dashboards, release-request handling, covenant and threshold-breach notifications.'],
    ['d1000000-0000-4000-8000-000000000036', 'Compliance & Risk', 'Chain-of-custody and audit-trail reporting, regulatory / warehouse-receipt-financing frameworks, insurer and external-auditor exports, discrepancy-trend analysis.'],
    ['d1000000-0000-4000-8000-000000000037', 'Workforce & Rostering', 'Inspector and supervisor rosters across sites, skills / certification / training records with expiry alerts, route planning, GPS-linked timesheets, cover and escalation.'],
    ['d1000000-0000-4000-8000-000000000038', 'IT & Integrations', 'Offline field-sync service, weighbridge / IoT sensor / mapping / lender-system / notification-gateway adapters, evidence object storage, integration health.'],
  ] as const;
  for (const [id, name, description] of cmsDepartments) {
    await prisma.department.upsert({
      where: { id },
      update: {},
      create: { id, companyId: collateral.id, name, description },
    });
  }
  // CMS starter policies are seeded further down, next to the C&F / WMS ones.

  await prisma.department.upsert({
    where: { id: 'd1000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: 'd1000000-0000-4000-8000-000000000001', companyId: holding.id, name: 'Finance' },
  });
  await prisma.department.upsert({
    where: { id: 'd1000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: 'd1000000-0000-4000-8000-000000000002', companyId: holding.id, name: 'Information Technology' },
  });

  console.log('Seeding demo users...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const mathias = await prisma.user.upsert({
    where: { email: 'm.okurut@morise-holdings.com' },
    update: {},
    create: {
      email: 'm.okurut@morise-holdings.com',
      passwordHash,
      firstName: 'Okurut',
      lastName: 'Mathias',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: mathias.id, roleId: rolesByName.get('Managing Director')! } },
    update: {},
    create: { userId: mathias.id, roleId: rolesByName.get('Managing Director')! },
  });
  await ensureScope(mathias.id, holding.id, null);

  // Starter policies for the Clearing & Forwarding subsidiary (27 August
  // 2026) — created by the MD, who set the subsidiary up.
  for (const [id, name, description] of [
    ['p1000000-0000-4000-8000-000000000010', 'KYC Documentation Requirement', 'Every client must provide TIN, business registration and directors’ IDs before a job file is opened.'],
    ['p1000000-0000-4000-8000-000000000011', 'Disbursement Pre-funding Threshold', 'Disbursements above UGX 10,000,000 on a client’s behalf require pre-funding or Managing Director sign-off.'],
    ['p1000000-0000-4000-8000-000000000012', 'Demurrage & Detention Escalation', 'Demurrage/detention risk must be flagged to the client and Finance at least 48 hours before free time expires.'],
    ['p1000000-0000-4000-8000-000000000013', 'Tax & Levy Rate Configuration', 'Duty, VAT, WHT (6%), Infrastructure Levy (1.5%), IDF (1%), Excise and Environmental Levy rates are held centrally and updated whenever URA revises them.'],
  ] as const) {
    const existing = await prisma.companyPolicy.findFirst({
      where: { companyId: 'a1000000-0000-4000-8000-000000000004', name },
    });
    if (!existing) {
      await prisma.companyPolicy.create({
        data: { id, companyId: 'a1000000-0000-4000-8000-000000000004', name, description, policyType: 'Compliance', createdBy: mathias.id },
      });
    }
  }

  // Starter policies for the Warehouse Management subsidiary (27 August 2026).
  for (const [id, name, description] of [
    ['p1000000-0000-4000-8000-000000000020', 'FEFO / FIFO Stock Rotation', 'Perishable and dated stock (pharma, food, agri-inputs) must be picked First-Expired-First-Out; all other stock First-In-First-Out.'],
    ['p1000000-0000-4000-8000-000000000021', 'Cycle Count Schedule', 'Every branch runs A-items weekly, B-items monthly and C-items quarterly; variances above 2% are escalated to the branch manager.'],
    ['p1000000-0000-4000-8000-000000000022', 'Write-off & Transfer Approval', 'Stock write-offs and inter-branch transfers above UGX 5,000,000 require branch-manager and Head Office approval.'],
    ['p1000000-0000-4000-8000-000000000023', 'EFRIS / VAT Configuration', '18% VAT and EFRIS invoicing settings are held centrally and updated only by Finance when URA revises them.'],
    ['p1000000-0000-4000-8000-000000000024', 'Offline Operation & Sync', 'Branches with unreliable connectivity (Gulu and rural sites) operate offline with local auto-save and must sync within 24 hours of connectivity resuming.'],
  ] as const) {
    const existing = await prisma.companyPolicy.findFirst({
      where: { companyId: 'a1000000-0000-4000-8000-000000000005', name },
    });
    if (!existing) {
      await prisma.companyPolicy.create({
        data: { id, companyId: 'a1000000-0000-4000-8000-000000000005', name, description, policyType: 'Operations', createdBy: mathias.id },
      });
    }
  }

  // Starter policies for the Collateral Management subsidiary (30 August 2026).
  for (const [id, name, description, policyType] of [
    ['p1000000-0000-4000-8000-000000000030', 'GPS & Evidence Integrity', 'Every site check-in must be geofence-verified; all inspection photos and video carry an automatic timestamp, geotag and tamper-evident hash. Out-of-boundary activity raises an alert.', 'Compliance'],
    ['p1000000-0000-4000-8000-000000000031', 'Dual-Control Release Approval', 'Any collateral release or substitution requires maker–checker approval and a lender OTP or digital-signature confirmation before stock may move.', 'Compliance'],
    ['p1000000-0000-4000-8000-000000000032', 'Coverage Threshold Auto-Hold', 'Stock movement is automatically blocked whenever it would take collateral coverage for a client / site below the agreed threshold, until a collateral manager clears the hold.', 'Operations'],
    ['p1000000-0000-4000-8000-000000000033', 'Offline Field Sync', 'Field devices operate fully offline at remote sites and must sync captured counts, checklists and evidence within 24 hours of connectivity resuming; no data is discarded on conflict.', 'Operations'],
    ['p1000000-0000-4000-8000-000000000034', 'Multi-Client Stock Segregation', 'Stock held at shared storage sites is logically separated by owner; commingling of one client’s collateral with another’s is prohibited and blocked at intake.', 'Compliance'],
    ['p1000000-0000-4000-8000-000000000035', 'Inspection Frequency by Risk', 'Each site’s inspection cadence is set by its risk classification; a missed or overdue inspection escalates automatically, faster for higher-risk sites.', 'Operations'],
  ] as const) {
    const existing = await prisma.companyPolicy.findFirst({
      where: { companyId: 'a1000000-0000-4000-8000-000000000006', name },
    });
    if (!existing) {
      await prisma.companyPolicy.create({
        data: { id, companyId: 'a1000000-0000-4000-8000-000000000006', name, description, policyType, createdBy: mathias.id },
      });
    }
  }

  console.log('Seeding starter company policies (morise.docx, Section 2: "Configure company-specific policies")...');
  const existingLeavePolicy = await prisma.companyPolicy.findFirst({ where: { companyId: holding.id, name: 'Group Leave Policy' } });
  if (!existingLeavePolicy) {
    await prisma.companyPolicy.create({
      data: {
        companyId: holding.id,
        name: 'Group Leave Policy',
        description: 'Standard annual leave entitlement and approval process applicable across all subsidiaries.',
        policyType: 'HR',
        effectiveDate: new Date('2026-01-01'),
        createdBy: mathias.id,
      },
    });
  }
  const existingProcurementPolicy = await prisma.companyPolicy.findFirst({ where: { companyId: agro.id, name: 'Procurement Approval Thresholds' } });
  if (!existingProcurementPolicy) {
    await prisma.companyPolicy.create({
      data: {
        companyId: agro.id,
        name: 'Procurement Approval Thresholds',
        description: 'Purchases above UGX 5,000,000 require Managing Director sign-off in addition to Procurement Manager approval.',
        policyType: 'Finance',
        effectiveDate: new Date('2026-01-01'),
        createdBy: mathias.id,
      },
    });
  }

  const godfrey = await prisma.user.upsert({
    where: { email: 'g.obeke@morise-holdings.com' },
    update: {},
    create: {
      email: 'g.obeke@morise-holdings.com',
      passwordHash,
      firstName: 'Obeke',
      lastName: 'Godfrey',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: godfrey.id, roleId: rolesByName.get('IT Administrator')! } },
    update: {},
    create: { userId: godfrey.id, roleId: rolesByName.get('IT Administrator')! },
  });
  await ensureScope(godfrey.id, holding.id, null);

  const kintu = await prisma.user.upsert({
    where: { email: 'p.kintu@morise-holdings.com' },
    update: {},
    create: {
      email: 'p.kintu@morise-holdings.com',
      passwordHash,
      firstName: 'Peter',
      lastName: 'Kintu',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: kintu.id, roleId: rolesByName.get('Branch Manager')! } },
    update: {},
    create: { userId: kintu.id, roleId: rolesByName.get('Branch Manager')! },
  });
  // Scoped to Morise Agro Ltd only — demonstrates BR-01: this user cannot
  // see Morise Holdings Limited or Morise Logistics Ltd via the API.
  await ensureScope(kintu.id, agro.id, null);

  const nakato = await prisma.user.upsert({
    where: { email: 'm.nakato@morise-holdings.com' },
    update: {},
    create: {
      email: 'm.nakato@morise-holdings.com',
      passwordHash,
      firstName: 'Mary',
      lastName: 'Nakato',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: nakato.id, roleId: rolesByName.get('Human Resources Manager')! } },
    update: {},
    create: { userId: nakato.id, roleId: rolesByName.get('Human Resources Manager')! },
  });
  await ensureScope(nakato.id, logistics.id, null);
  // HR Module deepening (19 August 2026): the request that opened this
  // pass opens with "The HR module should manage employees across all
  // companies." Nakato's Logistics-only scope, correct for demonstrating
  // BR-01 in every earlier sprint, became a genuine demo-reachability gap
  // for this pass specifically — no seeded user could reach Recruitment/
  // Attendance/Leave/Performance "manage" actions for Morise Agro Ltd's
  // employees at all (Human Resources Manager is the only role holding
  // leave.manage/recruitment.manage/attendance.manage/performance.manage,
  // and Nakato held no Agro scope), the same "correct code, unreachable
  // through the demo" gap class Sprint 2 found for company management.
  // Fixed by adding a second scope, not by changing any permission — an
  // HR Manager legitimately covering multiple subsidiaries is exactly
  // what the request's own framing describes.
  await ensureScope(nakato.id, agro.id, null);

  const smith = await prisma.user.upsert({
    where: { email: 'a.smith@morise-holdings.com' },
    update: {},
    create: {
      email: 'a.smith@morise-holdings.com',
      passwordHash,
      firstName: 'Alan',
      lastName: 'Smith',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: smith.id, roleId: rolesByName.get('Finance Manager')! } },
    update: {},
    create: { userId: smith.id, roleId: rolesByName.get('Finance Manager')! },
  });
  await ensureScope(smith.id, agro.id, null);

  const namuli = await prisma.user.upsert({
    where: { email: 's.namuli@morise-holdings.com' },
    update: {},
    create: {
      email: 's.namuli@morise-holdings.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Namuli',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: namuli.id, roleId: rolesByName.get('Sales Manager')! } },
    update: {},
    create: { userId: namuli.id, roleId: rolesByName.get('Sales Manager')! },
  });
  await ensureScope(namuli.id, agro.id, null);

  const kato = await prisma.user.upsert({
    where: { email: 'r.kato@morise-holdings.com' },
    update: {},
    create: {
      email: 'r.kato@morise-holdings.com',
      passwordHash,
      firstName: 'Ronald',
      lastName: 'Kato',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: kato.id, roleId: rolesByName.get('Procurement Manager')! } },
    update: {},
    create: { userId: kato.id, roleId: rolesByName.get('Procurement Manager')! },
  });
  await ensureScope(kato.id, agro.id, null);

  console.log('Seeding starter employee records for Morise Agro Ltd...');
  await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId: agro.id, employeeNumber: 'EMP-0001' } },
    update: {},
    create: {
      companyId: agro.id,
      branchId: 'b1000000-0000-4000-8000-000000000001',
      employeeNumber: 'EMP-0001',
      firstName: 'Grace',
      lastName: 'Auma',
      jobTitle: 'Sales Officer',
      employmentStartDate: new Date('2024-03-01'),
      bankName: 'Equity Bank (U) Ltd',
      bankAccountNumber: '4001223344',
    },
  });
  await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId: agro.id, employeeNumber: 'EMP-0002' } },
    update: {},
    create: {
      companyId: agro.id,
      branchId: 'b1000000-0000-4000-8000-000000000001',
      employeeNumber: 'EMP-0002',
      firstName: 'David',
      lastName: 'Ssenyonga',
      jobTitle: 'Warehouse Assistant',
      employmentStartDate: new Date('2023-09-15'),
      bankName: 'Equity Bank (U) Ltd',
      bankAccountNumber: '4001998877',
    },
  });

  console.log('Seeding starter chart of accounts and a posted journal entry for Morise Agro Ltd...');
  // Dashboard deepening: this proof-of-concept has always kept cash and
  // bank as one combined account (never split by design) — tagged `bank`
  // rather than `cash` since a real "Cash and Bank" balance is almost
  // entirely bank-held for a company this size; the dashboard's "Cash
  // Position" and "Bank Balances" tiles will read as the same figure for
  // that reason, documented in mbms/README.md rather than left silent.
  const cash = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '1000' } },
    update: { accountSubType: 'bank' },
    create: { companyId: agro.id, accountCode: '1000', accountName: 'Cash and Bank', accountType: 'asset', accountSubType: 'bank' },
  });
  // Accounts Receivable / Payable: no Sales or Procurement module exists in
  // this codebase to ever post to these, so they seed at a correct 0.00 —
  // present so the dashboard's Outstanding Receivables/Payables tiles have
  // a real (if currently empty) account to sum, the same
  // schema-ready-but-honestly-empty pattern already used for FR-CUST-03's
  // customer statement.
  await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '1100' } },
    update: { accountSubType: 'receivable' },
    create: { companyId: agro.id, accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'asset', accountSubType: 'receivable' },
  });
  await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '2000' } },
    update: { accountSubType: 'payable' },
    create: { companyId: agro.id, accountCode: '2000', accountName: 'Accounts Payable', accountType: 'liability', accountSubType: 'payable' },
  });
  const retainedEarnings = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '3000' } },
    update: {},
    create: { companyId: agro.id, accountCode: '3000', accountName: 'Retained Earnings', accountType: 'equity' },
  });
  const salesRevenue = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '4000' } },
    update: {},
    create: { companyId: agro.id, accountCode: '4000', accountName: 'Sales Revenue', accountType: 'revenue' },
  });
  await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5000' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'expense' },
  });
  // Sprint 9 (Expense Management) — expense claim accounts, distinct from
  // Cost of Goods Sold above.
  const travelExpense = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5100' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5100', accountName: 'Travel and Entertainment', accountType: 'expense' },
  });
  const officeExpense = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5200' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5200', accountName: 'Office Supplies', accountType: 'expense' },
  });
  // Sprint 10 (Full Accounting) — a rent account, used by the seeded
  // recurring journal entry template below.
  const rentExpense = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5300' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5300', accountName: 'Rent Expense', accountType: 'expense' },
  });

  const fy2026 = await prisma.financialPeriod.findFirst({
    where: { companyId: agro.id, periodName: 'FY2026-Q1' },
  });
  const period =
    fy2026 ??
    (await prisma.financialPeriod.create({
      data: {
        companyId: agro.id,
        periodName: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
      },
    }));

  const existingOpeningEntry = await prisma.journalEntry.findFirst({
    where: { companyId: agro.id, entryNumber: 'JE-2026-0001' },
  });
  if (!existingOpeningEntry) {
    await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: 'JE-2026-0001',
        entryDate: new Date('2026-01-02'),
        description: 'Owner capital injection — opening balance',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-01-02'),
        items: {
          create: [
            { accountId: cash.id, debitAmount: 5_000_000, creditAmount: 0 },
            { accountId: retainedEarnings.id, debitAmount: 0, creditAmount: 5_000_000 },
          ],
        },
      },
    });
  }

  // Sprint 10 (Full Accounting) — a revenue posting, so the Income
  // Statement report has more than expense activity to show (the expense
  // claim postings from Sprint 9 already cover the expense side).
  const existingSalesEntry = await prisma.journalEntry.findFirst({
    where: { companyId: agro.id, entryNumber: 'JE-2026-0002' },
  });
  if (!existingSalesEntry) {
    await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: 'JE-2026-0002',
        entryDate: new Date('2026-02-10'),
        description: 'Cash sale — maize seed and fertilizer',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-02-10'),
        items: {
          create: [
            { accountId: cash.id, debitAmount: 800_000, creditAmount: 0 },
            { accountId: salesRevenue.id, debitAmount: 0, creditAmount: 800_000 },
          ],
        },
      },
    });
  }

  console.log('Seeding starter chart of accounts and a posted journal entry for Morise Logistics Ltd (Sprint 10 — consolidated reporting demo)...');
  const logisticsCash = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '1000' } },
    update: { accountSubType: 'bank' },
    create: { companyId: logistics.id, accountCode: '1000', accountName: 'Cash and Bank', accountType: 'asset', accountSubType: 'bank' },
  });
  await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '1100' } },
    update: { accountSubType: 'receivable' },
    create: { companyId: logistics.id, accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'asset', accountSubType: 'receivable' },
  });
  await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '2000' } },
    update: { accountSubType: 'payable' },
    create: { companyId: logistics.id, accountCode: '2000', accountName: 'Accounts Payable', accountType: 'liability', accountSubType: 'payable' },
  });
  const logisticsRetainedEarnings = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '3000' } },
    update: {},
    create: { companyId: logistics.id, accountCode: '3000', accountName: 'Retained Earnings', accountType: 'equity' },
  });
  const logisticsFreightRevenue = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '4000' } },
    update: {},
    create: { companyId: logistics.id, accountCode: '4000', accountName: 'Freight Revenue', accountType: 'revenue' },
  });
  const logisticsFuelExpense = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '5000' } },
    update: {},
    create: { companyId: logistics.id, accountCode: '5000', accountName: 'Fuel and Maintenance', accountType: 'expense' },
  });

  // Same period name as Agro's ("FY2026-Q1") deliberately — the consolidated
  // report endpoints match subsidiary periods to the root company's period
  // by name, not by ID (see reports.controller.ts's buildConsolidated).
  const logisticsPeriod =
    (await prisma.financialPeriod.findFirst({ where: { companyId: logistics.id, periodName: 'FY2026-Q1' } })) ??
    (await prisma.financialPeriod.create({
      data: { companyId: logistics.id, periodName: 'FY2026-Q1', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    }));

  const existingLogisticsOpening = await prisma.journalEntry.findFirst({
    where: { companyId: logistics.id, entryNumber: 'JE-2026-0001' },
  });
  if (!existingLogisticsOpening) {
    await prisma.journalEntry.create({
      data: {
        companyId: logistics.id,
        entryNumber: 'JE-2026-0001',
        entryDate: new Date('2026-01-05'),
        description: 'Owner capital injection — opening balance',
        financialPeriodId: logisticsPeriod.id,
        status: 'posted',
        createdBy: nakato.id,
        postedAt: new Date('2026-01-05'),
        items: {
          create: [
            { accountId: logisticsCash.id, debitAmount: 3_000_000, creditAmount: 0 },
            { accountId: logisticsRetainedEarnings.id, debitAmount: 0, creditAmount: 3_000_000 },
          ],
        },
      },
    });
  }
  const existingLogisticsFreightEntry = await prisma.journalEntry.findFirst({
    where: { companyId: logistics.id, entryNumber: 'JE-2026-0002' },
  });
  if (!existingLogisticsFreightEntry) {
    await prisma.journalEntry.create({
      data: {
        companyId: logistics.id,
        entryNumber: 'JE-2026-0002',
        entryDate: new Date('2026-02-15'),
        description: 'Freight delivery — Jinja to Kampala route',
        financialPeriodId: logisticsPeriod.id,
        status: 'posted',
        createdBy: nakato.id,
        postedAt: new Date('2026-02-15'),
        items: {
          create: [
            { accountId: logisticsCash.id, debitAmount: 420_000, creditAmount: 0 },
            { accountId: logisticsFreightRevenue.id, debitAmount: 0, creditAmount: 420_000 },
          ],
        },
      },
    });
    await prisma.journalEntry.create({
      data: {
        companyId: logistics.id,
        entryNumber: 'JE-2026-0003',
        entryDate: new Date('2026-02-16'),
        description: 'Fuel for Jinja route delivery truck',
        financialPeriodId: logisticsPeriod.id,
        status: 'posted',
        createdBy: nakato.id,
        postedAt: new Date('2026-02-16'),
        items: {
          create: [
            { accountId: logisticsFuelExpense.id, debitAmount: 95_000, creditAmount: 0 },
            { accountId: logisticsCash.id, debitAmount: 0, creditAmount: 95_000 },
          ],
        },
      },
    });
  }

  console.log('Seeding a demo inter-company transaction (morise.docx, Section 2: "Maintain inter-company transactions")...');
  const agroDueFromLogistics = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '1700' } },
    update: {},
    create: { companyId: agro.id, accountCode: '1700', accountName: 'Due from Morise Logistics Ltd', accountType: 'asset' },
  });
  const logisticsDueToAgro = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: logistics.id, accountCode: '2100' } },
    update: {},
    create: { companyId: logistics.id, accountCode: '2100', accountName: 'Due to Morise Agro Ltd', accountType: 'liability' },
  });
  const existingIct = await prisma.interCompanyTransaction.findFirst({ where: { fromCompanyId: agro.id, toCompanyId: logistics.id } });
  if (!existingIct) {
    const agroIctEntryCount = await prisma.journalEntry.count({ where: { companyId: agro.id } });
    const agroIctEntry = await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: `JE-${new Date().getFullYear()}-${String(agroIctEntryCount + 1).padStart(4, '0')}`,
        entryDate: new Date('2026-05-01'),
        description: 'Inter-company loan to Morise Logistics Ltd',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-05-01'),
        items: {
          create: [
            { accountId: agroDueFromLogistics.id, debitAmount: 2_000_000, creditAmount: 0, description: 'Due from related company' },
            { accountId: cash.id, debitAmount: 0, creditAmount: 2_000_000, description: 'Inter-company transaction' },
          ],
        },
      },
    });
    const logisticsIctEntryCount = await prisma.journalEntry.count({ where: { companyId: logistics.id } });
    const logisticsIctEntry = await prisma.journalEntry.create({
      data: {
        companyId: logistics.id,
        entryNumber: `JE-${new Date().getFullYear()}-${String(logisticsIctEntryCount + 1).padStart(4, '0')}`,
        entryDate: new Date('2026-05-01'),
        description: 'Inter-company loan from Morise Agro Ltd',
        financialPeriodId: logisticsPeriod.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-05-01'),
        items: {
          create: [
            { accountId: logisticsCash.id, debitAmount: 2_000_000, creditAmount: 0, description: 'Inter-company transaction' },
            { accountId: logisticsDueToAgro.id, debitAmount: 0, creditAmount: 2_000_000, description: 'Due to related company' },
          ],
        },
      },
    });
    await prisma.interCompanyTransaction.create({
      data: {
        fromCompanyId: agro.id,
        toCompanyId: logistics.id,
        transactionType: 'loan',
        amount: 2_000_000,
        currency: 'UGX',
        description: 'Working capital loan to cover Q2 fuel costs',
        transactionDate: new Date('2026-05-01'),
        status: 'posted',
        fromAccountId: cash.id,
        fromClearingAccountId: agroDueFromLogistics.id,
        toClearingAccountId: logisticsDueToAgro.id,
        toAccountId: logisticsCash.id,
        fromJournalEntryId: agroIctEntry.id,
        toJournalEntryId: logisticsIctEntry.id,
        createdBy: smith.id,
        postedBy: smith.id,
        postedAt: new Date('2026-05-01'),
      },
    });
  }

  console.log('Seeding a recurring journal entry template for Morise Agro Ltd (FR-ACC-07)...');
  const existingRecurring = await prisma.recurringJournalEntry.findFirst({
    where: { companyId: agro.id, name: 'Monthly Office Rent' },
  });
  if (!existingRecurring) {
    await prisma.recurringJournalEntry.create({
      data: {
        companyId: agro.id,
        name: 'Monthly Office Rent',
        description: 'Kira HQ office rent — generate on the 1st of each month',
        createdBy: smith.id,
        items: {
          create: [
            { accountId: rentExpense.id, debitAmount: 250_000, creditAmount: 0, description: 'Office rent' },
            { accountId: cash.id, debitAmount: 0, creditAmount: 250_000, description: 'Office rent payment' },
          ],
        },
      },
    });
  }

  console.log('Seeding starter assets for Morise Agro Ltd (Sprint 11)...');
  const fixedAssetsAccount = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '1500' } },
    update: {},
    create: { companyId: agro.id, accountCode: '1500', accountName: 'Fixed Assets', accountType: 'asset' },
  });
  const accumulatedDepreciationAccount = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '1600' } },
    update: {},
    create: { companyId: agro.id, accountCode: '1600', accountName: 'Accumulated Depreciation', accountType: 'asset' },
  });
  const depreciationExpenseAccount = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5400' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5400', accountName: 'Depreciation Expense', accountType: 'expense' },
  });
  const gainOnDisposalAccount = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '4100' } },
    update: {},
    create: { companyId: agro.id, accountCode: '4100', accountName: 'Gain on Disposal of Assets', accountType: 'revenue' },
  });
  const lossOnDisposalAccount = await prisma.account.upsert({
    where: { companyId_accountCode: { companyId: agro.id, accountCode: '5500' } },
    update: {},
    create: { companyId: agro.id, accountCode: '5500', accountName: 'Loss on Disposal of Assets', accountType: 'expense' },
  });

  const grace = await prisma.employee.findFirst({ where: { companyId: agro.id, employeeNumber: 'EMP-0001' } });
  const david = await prisma.employee.findFirst({ where: { companyId: agro.id, employeeNumber: 'EMP-0002' } });

  // Asset 1 — active, fresh: a live demo target for "Record Depreciation".
  const hilux = await prisma.asset.findFirst({ where: { companyId: agro.id, assetNumber: 'AST-0001' } });
  if (!hilux) {
    await prisma.asset.create({
      data: {
        companyId: agro.id,
        branchId: 'b1000000-0000-4000-8000-000000000001',
        assetNumber: 'AST-0001',
        name: 'Toyota Hilux Pickup',
        category: 'Vehicle',
        description: 'Field operations pickup truck',
        custodianEmployeeId: grace?.id,
        purchaseDate: new Date('2025-02-01'),
        purchaseCost: 45_000_000,
        depreciationMethod: 'straight_line',
        usefulLifeYears: 5,
        salvageValue: 5_000_000,
        assetAccountId: fixedAssetsAccount.id,
        depreciationExpenseAccountId: depreciationExpenseAccount.id,
        accumulatedDepreciationAccountId: accumulatedDepreciationAccount.id,
        insurer: 'Jubilee Insurance (U) Ltd',
        insurancePolicyNumber: 'JIU-VEH-88213',
        insuranceExpiryDate: new Date('2027-01-31'),
      },
    });
  }

  // Asset 2 — disposal_requested: a live demo target for "Approve Disposal" then "Dispose".
  const laptop = await prisma.asset.findFirst({ where: { companyId: agro.id, assetNumber: 'AST-0002' } });
  if (!laptop) {
    await prisma.asset.create({
      data: {
        companyId: agro.id,
        assetNumber: 'AST-0002',
        name: 'Dell Latitude Laptop',
        category: 'IT Equipment',
        custodianEmployeeId: david?.id,
        purchaseDate: new Date('2023-06-15'),
        purchaseCost: 3_500_000,
        accumulatedDepreciation: 2_000_000,
        depreciationMethod: 'straight_line',
        usefulLifeYears: 3,
        salvageValue: 200_000,
        assetAccountId: fixedAssetsAccount.id,
        depreciationExpenseAccountId: depreciationExpenseAccount.id,
        accumulatedDepreciationAccountId: accumulatedDepreciationAccount.id,
        status: 'disposal_requested',
        disposalRequestedBy: kato.id,
        disposalRequestedAt: new Date('2026-08-10'),
        disposalRequestReason: 'Screen damaged beyond economical repair',
      },
    });
  }

  // Asset 3 — already fully disposed, with a real posted derecognition entry,
  // demonstrating the complete lifecycle at a glance (same pattern Sprint 9
  // used for its third seeded expense claim).
  const printer = await prisma.asset.findFirst({ where: { companyId: agro.id, assetNumber: 'AST-0003' } });
  if (!printer) {
    const disposalEntryCount = await prisma.journalEntry.count({ where: { companyId: agro.id } });
    const disposalEntryNumber = `JE-${new Date().getFullYear()}-${String(disposalEntryCount + 1).padStart(4, '0')}`;
    const disposalEntry = await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: disposalEntryNumber,
        entryDate: new Date('2026-06-30'),
        description: 'Disposal — AST-0003 Office Printer - HP LaserJet (sale)',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-06-30'),
        items: {
          create: [
            { accountId: accumulatedDepreciationAccount.id, debitAmount: 1_000_000, creditAmount: 0, description: 'Accumulated depreciation written off' },
            { accountId: cash.id, debitAmount: 150_000, creditAmount: 0, description: 'Disposal proceeds' },
            { accountId: lossOnDisposalAccount.id, debitAmount: 50_000, creditAmount: 0, description: 'Loss on disposal' },
            { accountId: fixedAssetsAccount.id, debitAmount: 0, creditAmount: 1_200_000, description: 'Fixed asset written off' },
          ],
        },
      },
    });
    await prisma.asset.create({
      data: {
        companyId: agro.id,
        assetNumber: 'AST-0003',
        name: 'Office Printer - HP LaserJet',
        category: 'IT Equipment',
        purchaseDate: new Date('2022-03-01'),
        purchaseCost: 1_200_000,
        accumulatedDepreciation: 1_000_000,
        depreciationMethod: 'straight_line',
        usefulLifeYears: 4,
        assetAccountId: fixedAssetsAccount.id,
        depreciationExpenseAccountId: depreciationExpenseAccount.id,
        accumulatedDepreciationAccountId: accumulatedDepreciationAccount.id,
        status: 'disposed',
        disposalRequestedBy: kato.id,
        disposalRequestedAt: new Date('2026-06-25'),
        disposalRequestReason: 'End of life, replaced by new unit',
        disposalApprovedBy: mathias.id,
        disposalApprovedAt: new Date('2026-06-28'),
        inspectionNotes: 'Confirmed non-functional, beyond repair',
        disposalMethod: 'sale',
        disposalProceeds: 150_000,
        disposedAt: new Date('2026-06-30'),
        disposalJournalEntryId: disposalEntry.id,
      },
    });
  }

  console.log('Seeding starter projects for Morise Agro Ltd (Sprint 12)...');
  // Project 1 — active, in progress: a live demo target for team/task/
  // milestone management.
  let warehouseProject = await prisma.project.findFirst({ where: { companyId: agro.id, projectCode: 'PRJ-0001' } });
  if (!warehouseProject) {
    warehouseProject = await prisma.project.create({
      data: {
        companyId: agro.id,
        branchId: 'b1000000-0000-4000-8000-000000000001',
        projectCode: 'PRJ-0001',
        name: 'Warehouse Expansion — Kira HQ',
        description: 'Add a second storage bay to the Kira HQ warehouse',
        managerEmployeeId: grace?.id,
        startDate: new Date('2026-06-01'),
        plannedEndDate: new Date('2026-12-15'),
        budget: 20_000_000,
        status: 'active',
        createdBy: kato.id,
      },
    });
    if (grace) await prisma.projectTeamMember.create({ data: { projectId: warehouseProject.id, employeeId: grace.id, role: 'Project Lead' } });
    if (david) await prisma.projectTeamMember.create({ data: { projectId: warehouseProject.id, employeeId: david.id, role: 'Site Coordinator' } });
    await prisma.projectTask.create({
      data: { projectId: warehouseProject.id, name: 'Site survey', status: 'done', assignedToEmployeeId: david?.id },
    });
    await prisma.projectTask.create({
      data: { projectId: warehouseProject.id, name: 'Contractor procurement', status: 'in_progress', assignedToEmployeeId: grace?.id, dueDate: new Date('2026-09-01') },
    });
    await prisma.projectMilestone.create({
      data: { projectId: warehouseProject.id, name: 'Foundation complete', dueDate: new Date('2026-10-01') },
    });
  }

  // Project 2 — already closed, with a real paid expense claim attributed
  // to it, demonstrating the profitability calculation end to end.
  let exportProject = await prisma.project.findFirst({ where: { companyId: agro.id, projectCode: 'PRJ-0002' } });
  if (!exportProject) {
    exportProject = await prisma.project.create({
      data: {
        companyId: agro.id,
        projectCode: 'PRJ-0002',
        name: 'Agro Export Contract — Kenya',
        description: 'One-off export contract for maize seed to a Kenyan distributor',
        managerEmployeeId: david?.id,
        startDate: new Date('2026-03-01'),
        plannedEndDate: new Date('2026-06-30'),
        actualEndDate: new Date('2026-06-30'),
        budget: 15_000_000,
        revenueAmount: 22_000_000,
        status: 'closed',
        createdBy: kato.id,
      },
    });
    if (grace) await prisma.projectTeamMember.create({ data: { projectId: exportProject.id, employeeId: grace.id, role: 'Logistics Coordinator' } });
    await prisma.projectMilestone.create({
      data: { projectId: exportProject.id, name: 'Shipment cleared customs', status: 'completed', completedAt: new Date('2026-06-20') },
    });

    const projExpenseCount = await prisma.journalEntry.count({ where: { companyId: agro.id } });
    const projExpenseEntryNumber = `JE-${new Date().getFullYear()}-${String(projExpenseCount + 1).padStart(4, '0')}`;
    const projExpenseEntry = await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: projExpenseEntryNumber,
        entryDate: new Date('2026-06-15'),
        description: 'Expense claim — Travel (export shipment logistics)',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-06-15'),
        items: {
          create: [
            { accountId: travelExpense.id, debitAmount: 480_000, creditAmount: 0, description: 'Expense claim' },
            { accountId: cash.id, debitAmount: 0, creditAmount: 480_000, description: 'Expense claim payment' },
          ],
        },
      },
    });
    await prisma.expense.create({
      data: {
        companyId: agro.id,
        projectId: exportProject.id,
        submittedBy: kato.id,
        category: 'Travel',
        description: 'Border logistics coordination — Kenya export shipment',
        amount: 480_000,
        currency: 'UGX',
        expenseDate: new Date('2026-06-14'),
        expenseAccountId: travelExpense.id,
        status: 'paid',
        managerApprovedBy: kintu.id,
        managerApprovedAt: new Date('2026-06-14'),
        financeApprovedBy: smith.id,
        financeApprovedAt: new Date('2026-06-15'),
        paidBy: smith.id,
        paidAt: new Date('2026-06-15'),
        journalEntryId: projExpenseEntry.id,
      },
    });
  }

  console.log('Seeding starter customers and suppliers for Morise Agro Ltd...');
  const highlandTraders = await prisma.customer.findFirst({
    where: { companyId: agro.id, name: 'Highland Traders Ltd' },
  });
  if (!highlandTraders) {
    await prisma.customer.create({
      data: {
        companyId: agro.id,
        name: 'Highland Traders Ltd',
        category: 'Wholesale',
        contactEmail: 'accounts@highlandtraders.co.ug',
        contactPhone: '+256 772 445 019',
        creditLimit: 10_000_000,
        paymentTermsDays: 30,
      },
    });
  }
  const sunriseSupermarkets = await prisma.customer.findFirst({
    where: { companyId: agro.id, name: 'Sunrise Supermarkets' },
  });
  if (!sunriseSupermarkets) {
    await prisma.customer.create({
      data: {
        companyId: agro.id,
        name: 'Sunrise Supermarkets',
        category: 'Retail',
        contactPhone: '+256 700 118 823',
        creditLimit: 3_000_000,
        paymentTermsDays: 14,
      },
    });
  }

  const agroChem = await prisma.supplier.findFirst({
    where: { companyId: agro.id, name: 'AgroChem Uganda Ltd' },
  });
  if (!agroChem) {
    await prisma.supplier.create({
      data: {
        companyId: agro.id,
        name: 'AgroChem Uganda Ltd',
        category: 'Raw Materials',
        contactEmail: 'sales@agrochem.co.ug',
        contactPhone: '+256 414 233 019',
        taxId: '1009944221',
        bankName: 'Equity Bank (U) Ltd',
        bankAccountNumber: '4009911223',
      },
    });
  }
  const zenithTraders = await prisma.supplier.findFirst({
    where: { companyId: agro.id, name: 'Zenith Traders' },
  });
  if (!zenithTraders) {
    await prisma.supplier.create({
      data: {
        companyId: agro.id,
        name: 'Zenith Traders',
        category: 'General Supplies',
        status: 'blacklisted',
      },
    });
  }

  console.log('Seeding starter product categories and products for Morise Agro Ltd...');
  let agroInputsCategory = await prisma.productCategory.findFirst({
    where: { companyId: agro.id, name: 'Agro Inputs' },
  });
  if (!agroInputsCategory) {
    agroInputsCategory = await prisma.productCategory.create({
      data: { companyId: agro.id, name: 'Agro Inputs' },
    });
  }
  let packagingCategory = await prisma.productCategory.findFirst({
    where: { companyId: agro.id, name: 'Packaging' },
  });
  if (!packagingCategory) {
    packagingCategory = await prisma.productCategory.create({
      data: { companyId: agro.id, name: 'Packaging' },
    });
  }

  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1001' } },
    update: {},
    create: {
      companyId: agro.id,
      categoryId: agroInputsCategory.id,
      productCode: 'PRD-1001',
      name: 'Maize Seed — 25kg Bag',
      unitOfMeasure: 'Bag',
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1002' } },
    update: {},
    create: {
      companyId: agro.id,
      categoryId: agroInputsCategory.id,
      productCode: 'PRD-1002',
      name: 'NPK Fertilizer — 50kg',
      unitOfMeasure: 'Bag',
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1004' } },
    update: {},
    create: {
      companyId: agro.id,
      categoryId: packagingCategory.id,
      productCode: 'PRD-1004',
      name: 'Woven Sack — 50kg',
      unitOfMeasure: 'Piece',
    },
  });

  // ===================== Customer Storefront (Sprint 16) =====================
  // Prices/stock for the 3 products above (nullable — added in this sprint),
  // 5 more products/categories matching screenshots/Customer/03-catalog.png
  // exactly, and a demo customer login (Highland Traders Ltd, already
  // seeded above as a plain Customer record) so the storefront is
  // demoable end-to-end immediately.
  console.log('Seeding Customer Storefront: catalog pricing, more products, delivery addresses, portal login, demo orders/invoices/payments/tickets (Sprint 16)...');
  await prisma.product.update({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1001' } },
    data: { unitPrice: 148_000, stockQuantity: 240 },
  });
  await prisma.product.update({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1002' } },
    data: { unitPrice: 210_000, stockQuantity: 86 },
  });
  await prisma.product.update({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1004' } },
    data: { unitPrice: 3_200, stockQuantity: 1_500 },
  });

  let fuelCategory = await prisma.productCategory.findFirst({ where: { companyId: agro.id, name: 'Fuel' } });
  if (!fuelCategory) fuelCategory = await prisma.productCategory.create({ data: { companyId: agro.id, name: 'Fuel' } });
  let warehouseCategory = await prisma.productCategory.findFirst({ where: { companyId: agro.id, name: 'Warehouse' } });
  if (!warehouseCategory) warehouseCategory = await prisma.productCategory.create({ data: { companyId: agro.id, name: 'Warehouse' } });
  let logisticsCategory = await prisma.productCategory.findFirst({ where: { companyId: agro.id, name: 'Logistics' } });
  if (!logisticsCategory) logisticsCategory = await prisma.productCategory.create({ data: { companyId: agro.id, name: 'Logistics' } });

  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1005' } },
    update: { unitPrice: 5_900, stockQuantity: 12_000 },
    create: {
      companyId: agro.id,
      categoryId: fuelCategory.id,
      productCode: 'PRD-1005',
      name: 'Diesel — Bulk (per litre)',
      unitOfMeasure: 'Litre',
      unitPrice: 5_900,
      stockQuantity: 12_000,
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1006' } },
    update: { unitPrice: 42_000, stockQuantity: 300 },
    create: {
      companyId: agro.id,
      categoryId: warehouseCategory.id,
      productCode: 'PRD-1006',
      name: 'Pallet — Standard',
      unitOfMeasure: 'Piece',
      unitPrice: 42_000,
      stockQuantity: 300,
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1007' } },
    update: { unitPrice: 96_000, stockQuantity: 180 },
    create: {
      companyId: agro.id,
      categoryId: agroInputsCategory.id,
      productCode: 'PRD-1007',
      name: 'Bean Seed — 10kg Bag',
      unitOfMeasure: 'Bag',
      unitPrice: 96_000,
      stockQuantity: 180,
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1008' } },
    update: { unitPrice: 180_000, stockQuantity: 6 },
    create: {
      companyId: agro.id,
      categoryId: logisticsCategory.id,
      productCode: 'PRD-1008',
      productType: 'service',
      name: 'Farm Trailer Rental — Day',
      unitOfMeasure: 'Day',
      unitPrice: 180_000,
      stockQuantity: 6,
    },
  });
  await prisma.product.upsert({
    where: { companyId_productCode: { companyId: agro.id, productCode: 'PRD-1009' } },
    update: { unitPrice: 76_500, stockQuantity: 95 },
    create: {
      companyId: agro.id,
      categoryId: agroInputsCategory.id,
      productCode: 'PRD-1009',
      name: 'Herbicide — 5L',
      unitOfMeasure: 'Jerrycan',
      unitPrice: 76_500,
      stockQuantity: 95,
    },
  });

  // Inventory section (28 August 2026): give the catalog products a re-order
  // threshold so the Admin "Inventory" screen has LOW-stock rows to show,
  // and record an opening-balance stock movement for each so the movement
  // ledger is populated on a fresh seed.
  const reorderByCode: Record<string, number> = {
    'PRD-1001': 60,
    'PRD-1002': 100, // on-hand 86 -> LOW
    'PRD-1004': 400,
    'PRD-1005': 3_000,
    'PRD-1006': 120,
    'PRD-1007': 200, // on-hand 180 -> LOW
    'PRD-1008': 10, // on-hand 6 -> LOW
    'PRD-1009': 40,
  };
  for (const [code, reorderPoint] of Object.entries(reorderByCode)) {
    const prod = await prisma.product.findFirst({ where: { companyId: agro.id, productCode: code } });
    if (!prod) continue;
    await prisma.product.update({ where: { id: prod.id }, data: { reorderPoint } });
    const already = await prisma.stockMovement.findFirst({ where: { productId: prod.id } });
    if (!already) {
      await prisma.stockMovement.create({
        data: {
          companyId: agro.id,
          productId: prod.id,
          movementType: 'count',
          quantity: prod.stockQuantity ?? 0,
          balanceAfter: prod.stockQuantity ?? 0,
          reason: 'Opening balance (system seed)',
          reference: 'SEED',
          createdBy: mathias.id,
        },
      });
    }
  }

  // ============ Storefront group catalogue (29 August 2026) ============
  // The Customer Storefront now shows every Morise subsidiary's products in
  // one shop, each tagged with the subsidiary and the branch that fulfils
  // it. Attribute Agro's catalogue to its two branches, and give a second
  // subsidiary — Morise Logistics Ltd — a real priced service catalogue so
  // the group shop is genuinely multi-company.
  console.log('Seeding storefront group catalogue: branch attribution for Agro products + Morise Logistics Ltd service catalogue (29 August 2026)...');

  const KIRA_HQ = 'b1000000-0000-4000-8000-000000000001';
  const MBALE_BRANCH = 'b1000000-0000-4000-8000-000000000002';
  const JINJA_BRANCH = 'b1000000-0000-4000-8000-000000000003';

  // Which Agro branch produces / stocks each product.
  const agroBranchByCode: Record<string, string> = {
    'PRD-1001': KIRA_HQ,
    'PRD-1002': KIRA_HQ,
    'PRD-1004': MBALE_BRANCH,
    'PRD-1005': KIRA_HQ,
    'PRD-1006': MBALE_BRANCH,
    'PRD-1007': MBALE_BRANCH,
    'PRD-1008': KIRA_HQ,
    'PRD-1009': KIRA_HQ,
  };
  for (const [code, branchId] of Object.entries(agroBranchByCode)) {
    const prod = await prisma.product.findFirst({ where: { companyId: agro.id, productCode: code } });
    if (prod) await prisma.product.update({ where: { id: prod.id }, data: { branchId } });
  }

  // Morise Logistics Ltd — service catalogue, all fulfilled from Jinja Branch.
  let freightCategory = await prisma.productCategory.findFirst({ where: { companyId: logistics.id, name: 'Freight Services' } });
  if (!freightCategory) freightCategory = await prisma.productCategory.create({ data: { companyId: logistics.id, name: 'Freight Services' } });
  let storageCategory = await prisma.productCategory.findFirst({ where: { companyId: logistics.id, name: 'Warehousing Services' } });
  if (!storageCategory) storageCategory = await prisma.productCategory.create({ data: { companyId: logistics.id, name: 'Warehousing Services' } });

  const logisticsServices = [
    { code: 'LOG-2001', categoryId: freightCategory.id, name: 'Road Freight — Kampala to Mombasa (per trip)', unitOfMeasure: 'Trip', unitPrice: 4_200_000, stockQuantity: 12, reorderPoint: 3 },
    { code: 'LOG-2002', categoryId: freightCategory.id, name: 'Road Freight — Kampala to Kigali (per trip)', unitOfMeasure: 'Trip', unitPrice: 2_800_000, stockQuantity: 10, reorderPoint: 3 },
    { code: 'LOG-2003', categoryId: freightCategory.id, name: 'Last-mile Delivery — Kampala metro (per drop)', unitOfMeasure: 'Drop', unitPrice: 25_000, stockQuantity: 400, reorderPoint: 50 },
    { code: 'LOG-2004', categoryId: storageCategory.id, name: 'Pallet Storage — Jinja warehouse (per pallet-month)', unitOfMeasure: 'Pallet-month', unitPrice: 45_000, stockQuantity: 600, reorderPoint: 100 },
  ];
  for (const s of logisticsServices) {
    await prisma.product.upsert({
      where: { companyId_productCode: { companyId: logistics.id, productCode: s.code } },
      update: { unitPrice: s.unitPrice, stockQuantity: s.stockQuantity, branchId: JINJA_BRANCH, categoryId: s.categoryId, reorderPoint: s.reorderPoint },
      create: {
        companyId: logistics.id,
        categoryId: s.categoryId,
        productCode: s.code,
        productType: 'service',
        name: s.name,
        unitOfMeasure: s.unitOfMeasure,
        unitPrice: s.unitPrice,
        stockQuantity: s.stockQuantity,
        reorderPoint: s.reorderPoint,
        branchId: JINJA_BRANCH,
      },
    });
  }

  // Home branch for the demo portal customers, so "which subsidiary and
  // branch is mine" is populated on a fresh seed.
  await prisma.customer.updateMany({ where: { accountNumber: 'CUST-0118' }, data: { homeBranchId: KIRA_HQ } });
  await prisma.customer.updateMany({ where: { contactEmail: 'demo@buyer.test' }, data: { homeBranchId: MBALE_BRANCH } });

  // Bring the last two subsidiaries — Morise Clearing & Forwarding Ltd and
  // Morise Warehouse Management Ltd — into the group storefront: give each a
  // minimal chart of accounts + an open period (so an order through the
  // storefront can be invoiced and GL-posted in that company's books), and a
  // priced service catalogue attributed to its branches. Their full
  // Clearing/Forwarding and WMS systems (docx 19 / 20) are still unbuilt —
  // this is the storefront-facing service list only.
  console.log('Seeding storefront catalogue for Morise Clearing & Forwarding Ltd and Morise Warehouse Management Ltd (29 August 2026)...');

  async function ensureStorefrontBooks(companyId: string) {
    const accounts: Array<[string, string, string, string | null]> = [
      ['1000', 'Cash and Bank', 'asset', 'bank'],
      ['1100', 'Accounts Receivable', 'asset', 'receivable'],
      ['2000', 'Accounts Payable', 'liability', 'payable'],
      ['3000', 'Retained Earnings', 'equity', null],
      ['4000', 'Service Revenue', 'revenue', null],
      ['5000', 'Cost of Services', 'expense', null],
    ];
    for (const [accountCode, accountName, accountType, accountSubType] of accounts) {
      await prisma.account.upsert({
        where: { companyId_accountCode: { companyId, accountCode } },
        update: accountSubType ? { accountSubType: accountSubType as any } : {},
        create: { companyId, accountCode, accountName, accountType: accountType as any, accountSubType: accountSubType as any },
      });
    }
    const period =
      (await prisma.financialPeriod.findFirst({ where: { companyId, periodName: 'FY2026-Q1' } })) ??
      (await prisma.financialPeriod.create({
        data: { companyId, periodName: 'FY2026-Q1', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
      }));
    return period;
  }

  async function ensureCategory(companyId: string, name: string) {
    return (
      (await prisma.productCategory.findFirst({ where: { companyId, name } })) ??
      (await prisma.productCategory.create({ data: { companyId, name } }))
    );
  }

  async function ensureService(
    companyId: string,
    categoryId: string,
    branchId: string,
    productCode: string,
    name: string,
    unitOfMeasure: string,
    unitPrice: number,
    stockQuantity: number,
    reorderPoint: number,
  ) {
    await prisma.product.upsert({
      where: { companyId_productCode: { companyId, productCode } },
      update: { unitPrice, stockQuantity, branchId, categoryId, reorderPoint },
      create: {
        companyId,
        categoryId,
        productCode,
        productType: 'service',
        name,
        unitOfMeasure,
        unitPrice,
        stockQuantity,
        reorderPoint,
        branchId,
      },
    });
  }

  // ---- Morise Clearing & Forwarding Ltd ----
  await ensureStorefrontBooks(clearingFwd.id);
  const CF_KAMPALA_HQ = 'b1000000-0000-4000-8000-000000000010';
  const CF_MALABA = 'b1000000-0000-4000-8000-000000000011';
  const CF_BUSIA = 'b1000000-0000-4000-8000-000000000012';
  const CF_ENTEBBE = 'b1000000-0000-4000-8000-000000000013';
  const cfCustoms = await ensureCategory(clearingFwd.id, 'Customs Clearance');
  const cfFreight = await ensureCategory(clearingFwd.id, 'Freight Forwarding');
  const cfTransit = await ensureCategory(clearingFwd.id, 'Transit & Documentation');
  await ensureService(clearingFwd.id, cfCustoms.id, CF_KAMPALA_HQ, 'CF-3001', 'Import Customs Clearance — full declaration (per entry)', 'Entry', 450_000, 200, 30);
  await ensureService(clearingFwd.id, cfCustoms.id, CF_ENTEBBE, 'CF-3002', 'Air Import Clearance — Entebbe (per AWB)', 'AWB', 380_000, 150, 25);
  await ensureService(clearingFwd.id, cfFreight.id, CF_KAMPALA_HQ, 'CF-3003', 'Ocean Freight Forwarding — Mombasa to Kampala (per 20ft container)', 'Container', 3_600_000, 40, 8);
  await ensureService(clearingFwd.id, cfFreight.id, CF_KAMPALA_HQ, 'CF-3004', 'Air Freight Forwarding — consolidation (per kg)', 'Kg', 14_500, 5_000, 500);
  await ensureService(clearingFwd.id, cfTransit.id, CF_MALABA, 'CF-3005', 'Transit Bond & T1 Documentation — Malaba corridor (per consignment)', 'Consignment', 220_000, 300, 40);
  await ensureService(clearingFwd.id, cfTransit.id, CF_BUSIA, 'CF-3006', 'Certificate of Origin & Export Permit handling (per set)', 'Set', 120_000, 250, 40);

  // ---- Morise Warehouse Management Ltd ----
  await ensureStorefrontBooks(warehousing.id);
  const WMS_KAMPALA = 'b1000000-0000-4000-8000-000000000020';
  const WMS_JINJA = 'b1000000-0000-4000-8000-000000000021';
  const WMS_MBARARA = 'b1000000-0000-4000-8000-000000000022';
  const wmsStorage = await ensureCategory(warehousing.id, 'Storage');
  const wmsHandling = await ensureCategory(warehousing.id, 'Handling & Fulfilment');
  const wmsValueAdd = await ensureCategory(warehousing.id, 'Value-Added Services');
  await ensureService(warehousing.id, wmsStorage.id, WMS_KAMPALA, 'WMS-4001', 'Ambient Pallet Storage — Kampala Central (per pallet-month)', 'Pallet-month', 42_000, 2_000, 300);
  await ensureService(warehousing.id, wmsStorage.id, WMS_KAMPALA, 'WMS-4002', 'Cold Storage — chilled (per pallet-month)', 'Pallet-month', 95_000, 400, 60);
  await ensureService(warehousing.id, wmsStorage.id, WMS_MBARARA, 'WMS-4003', 'Bonded Warehouse Storage — Mbarara (per pallet-month)', 'Pallet-month', 55_000, 500, 80);
  await ensureService(warehousing.id, wmsHandling.id, WMS_KAMPALA, 'WMS-4004', 'Inbound Handling & Putaway (per pallet)', 'Pallet', 12_000, 10_000, 1_000);
  await ensureService(warehousing.id, wmsHandling.id, WMS_JINJA, 'WMS-4005', 'Pick, Pack & Dispatch — Jinja (per order line)', 'Order line', 3_500, 50_000, 5_000);
  await ensureService(warehousing.id, wmsValueAdd.id, WMS_KAMPALA, 'WMS-4006', 'Cycle Count & Inventory Reconciliation (per visit)', 'Visit', 180_000, 300, 40);

  // ---- Morise Collateral Management Ltd (30 August 2026) ----
  // Priced service catalogue for the collateral management agent, mapped
  // from docx/21 §12 (the "Services Offered by Collateral Management
  // Companies" reference catalogue) onto its six sites. Ten services across
  // five storefront categories: custody & control, inspection &
  // verification, stock & movement control, risk & valuation, and reporting
  // & compliance / advisory.
  console.log('Seeding storefront catalogue for Morise Collateral Management Ltd (30 August 2026)...');
  await ensureStorefrontBooks(collateral.id);
  const CMC_HQ = 'b1000000-0000-4000-8000-000000000030';
  const CMC_JINJA = 'b1000000-0000-4000-8000-000000000031';
  const CMC_MBALE = 'b1000000-0000-4000-8000-000000000032';
  const CMC_MASINDI = 'b1000000-0000-4000-8000-000000000033';
  const CMC_KASESE = 'b1000000-0000-4000-8000-000000000034';
  const CMC_BUIKWE = 'b1000000-0000-4000-8000-000000000035';
  const cmcCustody = await ensureCategory(collateral.id, 'Custody & Control');
  const cmcInspection = await ensureCategory(collateral.id, 'Inspection & Verification');
  const cmcMovement = await ensureCategory(collateral.id, 'Stock & Movement Control');
  const cmcRisk = await ensureCategory(collateral.id, 'Risk & Valuation');
  const cmcReporting = await ensureCategory(collateral.id, 'Reporting & Compliance');
  await ensureService(collateral.id, cmcCustody.id, CMC_HQ, 'CMC-5001', 'Collateral Management Agreement (CMA) — setup & onboarding (per agreement)', 'Agreement', 2_500_000, 60, 10);
  await ensureService(collateral.id, cmcCustody.id, CMC_JINJA, 'CMC-5002', 'Field Warehousing Control — borrower-site custody (per site-month)', 'Site-month', 4_200_000, 120, 20);
  await ensureService(collateral.id, cmcInspection.id, CMC_MASINDI, 'CMC-5003', 'Stock Inspection Visit — quantity, quality & sampling (per visit)', 'Visit', 320_000, 800, 100);
  await ensureService(collateral.id, cmcInspection.id, CMC_BUIKWE, 'CMC-5004', 'Weighbridge & Tank / Silo Gauging (per measurement)', 'Measurement', 180_000, 1_000, 120);
  await ensureService(collateral.id, cmcMovement.id, CMC_HQ, 'CMC-5005', 'Stock Reconciliation & Variance Report (per cycle)', 'Cycle', 450_000, 400, 50);
  await ensureService(collateral.id, cmcMovement.id, CMC_HQ, 'CMC-5006', 'Dual-Control Release Authorization (per release)', 'Release', 95_000, 5_000, 500);
  await ensureService(collateral.id, cmcRisk.id, CMC_HQ, 'CMC-5007', 'Collateral Valuation & Coverage-Ratio Monitoring (per facility-month)', 'Facility-month', 1_100_000, 200, 30);
  await ensureService(collateral.id, cmcReporting.id, CMC_HQ, 'CMC-5008', 'Daily Stock-Position Reporting & Lender Portal Access (per facility-month)', 'Facility-month', 650_000, 250, 40);
  await ensureService(collateral.id, cmcReporting.id, CMC_MBALE, 'CMC-5009', 'Warehouse Receipt Issuance — negotiable / non-negotiable (per receipt)', 'Receipt', 75_000, 3_000, 300);
  await ensureService(collateral.id, cmcReporting.id, CMC_KASESE, 'CMC-5010', 'Facility / Site Accreditation Assessment (per site)', 'Site', 1_800_000, 80, 15);

  // Marketing & Promos + CMS / Site Builder (28 August 2026): demo discount
  // codes and a promo banner for Morise Agro Ltd, plus a few storefront
  // content pages, so the two newly-activated Admin sections and their
  // storefront consumption are demoable immediately.
  console.log('Seeding Marketing & Promos (discount codes, banner) and CMS content blocks (28 August 2026)...');
  for (const dc of [
    { code: 'WELCOME10', description: '10% off your first order (min UGX 100,000).', discountType: 'percentage' as const, value: 10, minOrderValue: 100_000, maxRedemptions: null as number | null },
    { code: 'AGRO50K', description: 'UGX 50,000 off orders over UGX 500,000.', discountType: 'fixed' as const, value: 50_000, minOrderValue: 500_000, maxRedemptions: 100 },
    { code: 'SEASON2025', description: 'Expired seasonal promo — kept to demonstrate the expiry path.', discountType: 'percentage' as const, value: 15, minOrderValue: null as number | null, maxRedemptions: null as number | null, endsAt: new Date('2025-12-31T23:59:59Z') },
  ]) {
    await prisma.discountCode.upsert({
      where: { companyId_code: { companyId: agro.id, code: dc.code } },
      update: {},
      create: {
        companyId: agro.id,
        code: dc.code,
        description: dc.description,
        discountType: dc.discountType,
        value: dc.value,
        minOrderValue: dc.minOrderValue ?? null,
        maxRedemptions: dc.maxRedemptions ?? null,
        endsAt: (dc as any).endsAt ?? null,
        createdBy: mathias.id,
      },
    });
  }
  // Storefront promotional banners (text-only per the PromoBanner schema).
  // A small curated set for the demo customer's company (Morise Agro Ltd)
  // so the storefront home has a realistic banner rail; the matching
  // brand banner graphics live in brand/banners/. Each is guarded so a
  // re-seed is idempotent.
  for (const pb of [
    {
      heading: 'Season stock-up — free delivery over UGX 1,000,000',
      body: 'Order your seeds, fertiliser and inputs now. Use code WELCOME10 for 10% off your first order.',
      linkUrl: '/shop',
      linkLabel: 'Shop now',
      sortOrder: 0,
    },
    {
      heading: 'One storefront for the whole group',
      body: 'Browse every Morise subsidiary and branch — inputs & fuel, logistics, clearing & forwarding, warehousing and collateral management — and settle it all on one account.',
      linkUrl: '/subsidiaries',
      linkLabel: 'Explore the group',
      sortOrder: 1,
    },
    {
      heading: 'Bulk fuel and haulage, booked online',
      body: 'Schedule fuel deliveries and freight with Morise Logistics without leaving the portal. Track every consignment to the door.',
      linkUrl: '/shop',
      linkLabel: 'Book a delivery',
      sortOrder: 2,
    },
  ]) {
    const existingPb = await prisma.promoBanner.findFirst({ where: { companyId: agro.id, heading: pb.heading } });
    if (!existingPb) {
      await prisma.promoBanner.create({
        data: {
          companyId: agro.id,
          heading: pb.heading,
          body: pb.body,
          linkUrl: pb.linkUrl,
          linkLabel: pb.linkLabel,
          placement: 'storefront_home',
          sortOrder: pb.sortOrder,
          active: true,
          createdBy: mathias.id,
        },
      });
    }
  }
  for (const cb of [
    { slug: 'about', title: 'About Morise', body: 'Morise Holdings Limited is a Ugandan group supplying agricultural inputs, fuel, logistics and warehousing to businesses across the region. This storefront lets our account customers browse the catalogue, place orders, track deliveries and settle invoices online.', publish: true },
    { slug: 'terms', title: 'Terms & Conditions', body: 'All orders placed through this storefront are subject to Morise Holdings Limited standard terms of trade. Prices are shown in Ugandan Shillings and include applicable taxes at checkout. Payment is due within the terms agreed for your account. Delivery timelines are estimates and may vary with season and location.', publish: true },
    { slug: 'delivery', title: 'Delivery & Returns', body: 'We deliver to registered addresses on your account. A standard delivery fee applies per order. Goods damaged in transit may be reported through the Support screen within 48 hours of delivery.', publish: true },
    { slug: 'home-promo-strip', title: 'Storefront promo strip (draft)', body: 'Draft copy for a future homepage strip — not yet published.', publish: false },
  ]) {
    const existing = await prisma.contentBlock.findUnique({ where: { slug: cb.slug } });
    if (!existing) {
      await prisma.contentBlock.create({
        data: {
          slug: cb.slug,
          title: cb.title,
          body: cb.body,
          publishedBody: cb.publish ? cb.body : null,
          status: cb.publish ? 'published' : 'draft',
          publishedAt: cb.publish ? new Date() : null,
          updatedBy: mathias.id,
        },
      });
    }
  }

  // Social media channels (29 August 2026) — managed in Admin » CMS / Site
  // Builder, shown in the storefront / corporate-site footer. Fixed ids so a
  // re-seed is idempotent.
  for (const sl of [
    { id: 'e1000000-0000-4000-8000-000000000001', platform: 'facebook' as const, label: 'Facebook', url: 'https://facebook.com/moriseholdings', sortOrder: 1 },
    { id: 'e1000000-0000-4000-8000-000000000002', platform: 'x' as const, label: 'X (Twitter)', url: 'https://x.com/moriseholdings', sortOrder: 2 },
    { id: 'e1000000-0000-4000-8000-000000000003', platform: 'linkedin' as const, label: 'LinkedIn', url: 'https://www.linkedin.com/company/morise-holdings', sortOrder: 3 },
    { id: 'e1000000-0000-4000-8000-000000000004', platform: 'instagram' as const, label: 'Instagram', url: 'https://instagram.com/moriseholdings', sortOrder: 4 },
    { id: 'e1000000-0000-4000-8000-000000000005', platform: 'whatsapp' as const, label: 'WhatsApp', url: 'https://wa.me/256700000000', sortOrder: 5, isVisible: false },
  ]) {
    await prisma.socialLink.upsert({
      where: { id: sl.id },
      update: {},
      create: {
        id: sl.id,
        platform: sl.platform,
        label: sl.label,
        url: sl.url,
        sortOrder: sl.sortOrder,
        isVisible: sl.isVisible ?? true,
        createdBy: mathias.id,
      },
    });
  }

  // Landing-page FAQ (29 August 2026) — managed in Admin » CMS / Site
  // Builder, shown in the FAQ section of the corporate landing page. Fixed
  // ids so a re-seed is idempotent.
  for (const fq of [
    {
      id: 'e2000000-0000-4000-8000-000000000001',
      question: 'How do I get an account on the Morise storefront?',
      answer: 'Business accounts are set up by Morise Holdings. If your organisation trades with any Morise company, ask your Morise representative to enable storefront access, or register from the sign-in page and we will link you to your account.',
      sortOrder: 1,
    },
    {
      id: 'e2000000-0000-4000-8000-000000000002',
      question: 'Can I buy from more than one Morise subsidiary in one order?',
      answer: 'You browse every subsidiary in one catalogue, but each order is placed and invoiced by the subsidiary that fulfils it. A basket spanning subsidiaries is split into one order per company at checkout.',
      sortOrder: 2,
    },
    {
      id: 'e2000000-0000-4000-8000-000000000003',
      question: 'Which languages and currencies does the storefront support?',
      answer: 'The interface is available in 43 languages. Prices are held in Ugandan Shillings and shown converted and formatted for your chosen language; your account is always invoiced in UGX.',
      sortOrder: 3,
    },
    {
      id: 'e2000000-0000-4000-8000-000000000004',
      question: 'How do I pay an invoice or raise a query?',
      answer: 'Signed in, open Invoices to settle an outstanding invoice online, or Support to raise a ticket. Delivery timelines shown at checkout are estimates and may vary by season and location.',
      sortOrder: 4,
    },
    {
      id: 'e2000000-0000-4000-8000-000000000005',
      question: 'Is this a live shop?',
      answer: 'This build is an internal proof of concept. Companies, prices, orders and payments shown here are demonstration data — no real order is fulfilled and no real payment is taken.',
      sortOrder: 5,
      isVisible: false,
    },
  ]) {
    await prisma.faqItem.upsert({
      where: { id: fq.id },
      update: {},
      create: {
        id: fq.id,
        question: fq.question,
        answer: fq.answer,
        sortOrder: fq.sortOrder,
        isVisible: fq.isVisible ?? true,
        createdBy: mathias.id,
      },
    });
  }

  // Site disclaimer (30 August 2026) — the statements shown on the full-page
  // disclaimer gate a signed-out visitor acknowledges before the landing
  // page (10-second hold + "I Understand, Continue"). Managed in Admin »
  // CMS / Site Builder. Fixed ids so a re-seed is idempotent.
  for (const [id, body, sortOrder] of [
    ['e3000000-0000-4000-8000-000000000001', 'This is an internal proof-of-concept build of the Morise Holdings Limited Business Management System.', 1],
    ['e3000000-0000-4000-8000-000000000002', 'Companies, figures, staff names, prices and news items shown here are illustrative demonstration data.', 2],
    ['e3000000-0000-4000-8000-000000000003', 'No real order is fulfilled and no real payment is taken; payment flows are simulated with no gateway connected.', 3],
    ['e3000000-0000-4000-8000-000000000004', 'Do not enter genuine personal, financial or confidential information anywhere in this environment.', 4],
    ['e3000000-0000-4000-8000-000000000005', 'Access to the customer portal is issued by Morise Holdings Limited to existing business accounts; there is no public self-registration for real accounts.', 5],
  ] as const) {
    await prisma.disclaimerItem.upsert({
      where: { id },
      update: {},
      create: { id, body, sortOrder, isVisible: true, createdBy: mathias.id },
    });
  }

  const catalogProducts = await prisma.product.findMany({
    where: { companyId: agro.id, productCode: { in: ['PRD-1001', 'PRD-1002', 'PRD-1004', 'PRD-1005', 'PRD-1006', 'PRD-1007', 'PRD-1008', 'PRD-1009'] } },
  });
  const productByCode = new Map(catalogProducts.map((p) => [p.productCode, p]));

  let highlandTradersPortal = await prisma.customer.findFirst({ where: { companyId: agro.id, name: 'Highland Traders Ltd' } });
  if (!highlandTradersPortal) {
    // Shouldn't happen (created earlier in this same run) — guarded anyway
    // so this section stands alone on a re-run against a partial database.
    highlandTradersPortal = await prisma.customer.create({
      data: {
        companyId: agro.id,
        name: 'Highland Traders Ltd',
        category: 'Wholesale',
        contactEmail: 'accounts@highlandtraders.co.ug',
        contactPhone: '+256 772 445 019',
        creditLimit: 10_000_000,
        paymentTermsDays: 30,
      },
    });
  }
  const customerPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  highlandTradersPortal = await prisma.customer.update({
    where: { id: highlandTradersPortal.id },
    data: {
      accountNumber: 'CUST-0118',
      passwordHash: customerPasswordHash,
      address: 'Plot 14, Republic Street, Mbale',
      // Raised from the original 10,000,000 seeded above (Sprint 4) —
      // the demo order history below already carries ~15.3M in unpaid
      // invoices on its own (2 overdue + 1 due-soon + 2 not-yet-due), so a
      // 10M limit would leave zero headroom to actually place a new order
      // live through the storefront. 20M keeps utilization high (~76%,
      // still reads as "mostly used") while leaving room to demo checkout.
      creditLimit: 20_000_000,
    },
  });

  let mbaleAddress = await prisma.deliveryAddress.findFirst({ where: { customerId: highlandTradersPortal.id, label: 'Mbale Store' } });
  if (!mbaleAddress) {
    mbaleAddress = await prisma.deliveryAddress.create({
      data: { customerId: highlandTradersPortal.id, label: 'Mbale Store', addressLine: 'Plot 14, Republic Street, Mbale', isDefault: true },
    });
  }
  let sorotiAddress = await prisma.deliveryAddress.findFirst({ where: { customerId: highlandTradersPortal.id, label: 'Soroti Depot' } });
  if (!sorotiAddress) {
    sorotiAddress = await prisma.deliveryAddress.create({
      data: { customerId: highlandTradersPortal.id, label: 'Soroti Depot', addressLine: 'Kichinjaji Road, Soroti', isDefault: false },
    });
  }

  // Seven orders across delivered/in-progress statuses, each posting a real
  // balanced sale entry (Dr Accounts Receivable, Cr Sales Revenue) at
  // creation — see CustomerOrdersService for the same posting done live for
  // an order placed through the storefront. Two are already paid (a second,
  // balanced settlement entry: Dr Cash, Cr Accounts Receivable), so
  // Invoices & Payments shows a real mix of paid/overdue/due-soon on first
  // login, not an empty screen.
  //
  // Guarded as one all-or-nothing batch (unlike every upsert-by-natural-key
  // above) because orderNumber/invoiceNumber/entryNumber here are generated
  // from a live prisma.count() at seed time, not a fixed literal — re-running
  // this block after a partial run would mint a fresh, higher-numbered batch
  // instead of recognizing the first one, silently doubling the customer's
  // outstanding balance. Found and fixed during this sprint's own
  // verification pass (a re-seed doubled Highland Traders' balance to
  // 30.6M and made every live "place order" test fail its credit-limit
  // check) — the same class of idempotency bug the rest of this file avoids
  // by keying on a real unique field instead.
  const alreadySeededOrders = await prisma.order.count({ where: { companyId: agro.id, customerId: highlandTradersPortal.id } });
  if (alreadySeededOrders > 0) {
    console.log('  ...customer storefront demo orders/invoices/payments/tickets already seeded, skipping.');
  } else {
  const receivableAccount = await prisma.account.findFirstOrThrow({ where: { companyId: agro.id, accountCode: '1100' } });

  const orderSpecs: {
    createdAt: Date;
    status: 'placed' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered';
    items: { code: string; quantity: number }[];
    dueDate: Date;
    paid?: { paidAt: Date; method: 'mobile_money' | 'bank_transfer' | 'card'; reference: string };
  }[] = [
    {
      createdAt: new Date('2026-03-02'),
      status: 'delivered',
      items: [{ code: 'PRD-1002', quantity: 6 }, { code: 'PRD-1007', quantity: 10 }],
      dueDate: new Date('2026-04-01'),
      paid: { paidAt: new Date('2026-03-28'), method: 'bank_transfer', reference: 'Equity Bank (U) Ltd' },
    },
    {
      createdAt: new Date('2026-04-14'),
      status: 'delivered',
      items: [{ code: 'PRD-1009', quantity: 20 }, { code: 'PRD-1004', quantity: 100 }],
      dueDate: new Date('2026-05-14'),
      paid: { paidAt: new Date('2026-08-14'), method: 'mobile_money', reference: '077••••981' },
    },
    {
      createdAt: new Date('2026-05-02'),
      status: 'delivered',
      items: [{ code: 'PRD-1002', quantity: 15 }],
      dueDate: new Date('2026-06-01'),
    },
    {
      createdAt: new Date('2026-05-18'),
      status: 'delivered',
      items: [{ code: 'PRD-1001', quantity: 20 }, { code: 'PRD-1005', quantity: 100 }],
      dueDate: new Date('2026-06-17'),
    },
    {
      createdAt: new Date('2026-07-28'),
      status: 'delivered',
      items: [{ code: 'PRD-1006', quantity: 30 }, { code: 'PRD-1008', quantity: 2 }],
      dueDate: new Date('2026-08-27'),
    },
    {
      createdAt: new Date('2026-08-09'),
      status: 'confirmed',
      items: [{ code: 'PRD-1002', quantity: 10 }],
      dueDate: new Date('2026-09-08'),
    },
    {
      createdAt: new Date('2026-08-16'),
      status: 'out_for_delivery',
      items: [{ code: 'PRD-1002', quantity: 8 }, { code: 'PRD-1001', quantity: 5 }],
      dueDate: new Date('2026-09-15'),
    },
  ];

  let orderSeq = await prisma.order.count({ where: { companyId: agro.id } });
  let invoiceSeq = await prisma.invoice.count({ where: { companyId: agro.id } });
  let journalSeq = await prisma.journalEntry.count({ where: { companyId: agro.id } });
  let lastOutForDeliveryOrder: { id: string; orderNumber: string } | null = null;
  let firstPaidInvoice: { id: string; invoiceNumber: string } | null = null;

  for (const spec of orderSpecs) {
    orderSeq += 1;
    const orderNumber = `ORD-2026-${String(orderSeq).padStart(4, '0')}`;
    const existingOrder = await prisma.order.findFirst({ where: { companyId: agro.id, orderNumber } });
    if (existingOrder) continue;

    const items = spec.items.map((i) => {
      const product = productByCode.get(i.code)!;
      const unitPrice = Number(product.unitPrice);
      return { productId: product.id, productName: product.name, unitPrice, quantity: i.quantity, subtotal: unitPrice * i.quantity };
    });
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const deliveryFee = 30_000;
    const vatAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + deliveryFee + vatAmount;

    journalSeq += 1;
    const saleEntryNumber = `JE-2026-${String(journalSeq).padStart(4, '0')}`;
    invoiceSeq += 1;
    const invoiceNumber = `INV-2026-${String(invoiceSeq).padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          companyId: agro.id,
          customerId: highlandTradersPortal!.id,
          status: spec.status,
          deliveryAddressId: mbaleAddress!.id,
          requestedDeliveryDate: spec.createdAt,
          paymentMethodPreference: spec.paid?.method ?? 'mobile_money',
          subtotal,
          deliveryFee,
          vatAmount,
          totalAmount,
          createdAt: spec.createdAt,
          items: { create: items },
        },
      });

      const saleEntry = await tx.journalEntry.create({
        data: {
          companyId: agro.id,
          entryNumber: saleEntryNumber,
          entryDate: spec.createdAt,
          description: `Sale — order ${orderNumber} (Highland Traders Ltd)`,
          financialPeriodId: period.id,
          status: 'posted',
          createdBy: smith.id,
          postedAt: spec.createdAt,
          items: {
            create: [
              { accountId: receivableAccount.id, debitAmount: totalAmount, creditAmount: 0, description: 'Accounts receivable — customer order' },
              { accountId: salesRevenue.id, debitAmount: 0, creditAmount: totalAmount, description: 'Sales revenue — customer order' },
            ],
          },
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          companyId: agro.id,
          customerId: highlandTradersPortal!.id,
          orderId: created.id,
          amount: totalAmount,
          dueDate: spec.dueDate,
          journalEntryId: saleEntry.id,
          createdAt: spec.createdAt,
          paidAt: spec.paid ? spec.paid.paidAt : null,
        },
      });

      return { created, invoice };
    });

    if (spec.status === 'out_for_delivery') lastOutForDeliveryOrder = result.created;

    if (spec.paid) {
      journalSeq += 1;
      const paymentEntryNumber = `JE-2026-${String(journalSeq).padStart(4, '0')}`;
      const paidResult = await prisma.$transaction(async (tx) => {
        const paymentEntry = await tx.journalEntry.create({
          data: {
            companyId: agro.id,
            entryNumber: paymentEntryNumber,
            entryDate: spec.paid!.paidAt,
            description: `Payment received — invoice ${result.invoice.invoiceNumber}`,
            financialPeriodId: period.id,
            status: 'posted',
            createdBy: smith.id,
            postedAt: spec.paid!.paidAt,
            items: {
              create: [
                { accountId: cash.id, debitAmount: totalAmount, creditAmount: 0, description: 'Payment received' },
                { accountId: receivableAccount.id, debitAmount: 0, creditAmount: totalAmount, description: 'Accounts receivable settled' },
              ],
            },
          },
        });
        const payment = await tx.payment.create({
          data: {
            companyId: agro.id,
            customerId: highlandTradersPortal!.id,
            method: spec.paid!.method,
            reference: spec.paid!.reference,
            amount: totalAmount,
            journalEntryId: paymentEntry.id,
            createdAt: spec.paid!.paidAt,
          },
        });
        await tx.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: result.invoice.id, amountApplied: totalAmount } });
        return payment;
      });
      void paidResult;
      if (!firstPaidInvoice) firstPaidInvoice = result.invoice;
    }
  }

  // An eighth, cancelled order — no invoice, matching how a real system
  // would void/never-issue one for an order cancelled this early — so the
  // My Orders screen shows a CANCELLED row too, not just successful ones.
  orderSeq += 1;
  const cancelledOrderNumber = `ORD-2026-${String(orderSeq).padStart(4, '0')}`;
  const existingCancelled = await prisma.order.findFirst({ where: { companyId: agro.id, orderNumber: cancelledOrderNumber } });
  if (!existingCancelled) {
    const cancelledProduct = productByCode.get('PRD-1004')!;
    const cUnitPrice = Number(cancelledProduct.unitPrice);
    const cQuantity = 50;
    const cSubtotal = cUnitPrice * cQuantity;
    const cDeliveryFee = 30_000;
    const cVat = Math.round(cSubtotal * 0.18);
    const cTotal = cSubtotal + cDeliveryFee + cVat;
    await prisma.order.create({
      data: {
        orderNumber: cancelledOrderNumber,
        companyId: agro.id,
        customerId: highlandTradersPortal.id,
        status: 'cancelled',
        deliveryAddressId: mbaleAddress.id,
        requestedDeliveryDate: new Date('2026-07-05'),
        paymentMethodPreference: 'mobile_money',
        subtotal: cSubtotal,
        deliveryFee: cDeliveryFee,
        vatAmount: cVat,
        totalAmount: cTotal,
        cancelledAt: new Date('2026-07-03'),
        cancellationReason: 'Duplicate order placed in error.',
        createdAt: new Date('2026-07-02'),
        items: { create: [{ productId: cancelledProduct.id, productName: cancelledProduct.name, unitPrice: cUnitPrice, quantity: cQuantity, subtotal: cSubtotal }] },
      },
    });
  }

  // Two support tickets: one open (awaiting a staff reply, referencing the
  // real out-for-delivery order above) and one already resolved (a short
  // customer/staff thread) — so Support isn't empty on first login either.
  let ticketSeq = await prisma.supportTicket.count({ where: { companyId: agro.id } });
  ticketSeq += 1;
  const ticket1Number = `TCK-${String(1000 + ticketSeq)}`;
  const existingTicket1 = await prisma.supportTicket.findFirst({ where: { companyId: agro.id, ticketNumber: ticket1Number } });
  if (!existingTicket1 && lastOutForDeliveryOrder) {
    const ticket1 = await prisma.supportTicket.create({
      data: {
        ticketNumber: ticket1Number,
        companyId: agro.id,
        customerId: highlandTradersPortal.id,
        category: 'delivery_issue',
        priority: 'high',
        subject: `Delivery delayed for ${lastOutForDeliveryOrder.orderNumber}`,
        description: `Order ${lastOutForDeliveryOrder.orderNumber} was due to arrive but hasn't yet. Please advise on a new ETA.`,
        relatedOrderId: lastOutForDeliveryOrder.id,
        status: 'awaiting_reply',
        createdAt: new Date('2026-08-17'),
      },
    });
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket1.id,
        authorType: 'customer',
        authorId: highlandTradersPortal.id,
        message: `Order ${lastOutForDeliveryOrder.orderNumber} was due yesterday but hasn't arrived. Please advise on a new ETA.`,
        createdAt: new Date('2026-08-17'),
      },
    });
  }

  ticketSeq += 1;
  const ticket2Number = `TCK-${String(1000 + ticketSeq)}`;
  const existingTicket2 = await prisma.supportTicket.findFirst({ where: { companyId: agro.id, ticketNumber: ticket2Number } });
  if (!existingTicket2 && firstPaidInvoice) {
    const ticket2 = await prisma.supportTicket.create({
      data: {
        ticketNumber: ticket2Number,
        companyId: agro.id,
        customerId: highlandTradersPortal.id,
        category: 'billing',
        priority: 'medium',
        subject: `Wrong quantity on ${firstPaidInvoice.invoiceNumber}`,
        description: `The quantity billed on ${firstPaidInvoice.invoiceNumber} looks higher than what was delivered — please recheck.`,
        relatedInvoiceId: firstPaidInvoice.id,
        status: 'resolved',
        createdAt: new Date('2026-04-20'),
      },
    });
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket2.id,
        authorType: 'customer',
        authorId: highlandTradersPortal.id,
        message: `The quantity billed on ${firstPaidInvoice.invoiceNumber} looks higher than what was delivered.`,
        createdAt: new Date('2026-04-20'),
      },
    });
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket2.id,
        authorType: 'staff',
        authorId: namuli.id,
        message: 'Checked the delivery note — the billed quantity was correct, a partial delivery note had been attached separately by mistake. Apologies for the confusion.',
        createdAt: new Date('2026-04-22'),
      },
    });
  }
  } // end alreadySeededOrders guard
  // ================== End Customer Storefront (Sprint 16) ====================

  console.log('Seeding starter expense claims for Morise Agro Ltd (Sprint 9)...');
  // Three claims at three different stages of the workflow, deliberately
  // submitted/approved by different scoped demo users (Kintu, Namuli, Kato,
  // Smith all hold an Agro Ltd scope) so the demo shows real separation of
  // duties rather than one user approving their own claim.
  const kintuClaim = await prisma.expense.findFirst({ where: { companyId: agro.id, submittedBy: kintu.id, category: 'Travel' } });
  if (!kintuClaim) {
    await prisma.expense.create({
      data: {
        companyId: agro.id,
        branchId: 'b1000000-0000-4000-8000-000000000001',
        submittedBy: kintu.id,
        category: 'Travel',
        description: 'Field visit to Mbale Branch — fuel and transport',
        amount: 150_000,
        currency: 'UGX',
        expenseDate: new Date('2026-08-10'),
        receiptReference: 'RCPT-2026-0141',
        expenseAccountId: travelExpense.id,
        status: 'submitted',
      },
    });
  }

  const namuliClaim = await prisma.expense.findFirst({ where: { companyId: agro.id, submittedBy: namuli.id, category: 'Office Supplies' } });
  if (!namuliClaim) {
    await prisma.expense.create({
      data: {
        companyId: agro.id,
        submittedBy: namuli.id,
        category: 'Office Supplies',
        description: 'Printer paper and toner for the sales office',
        amount: 45_000,
        currency: 'UGX',
        expenseDate: new Date('2026-08-05'),
        receiptReference: 'RCPT-2026-0098',
        expenseAccountId: officeExpense.id,
        status: 'manager_approved',
        managerApprovedBy: kato.id,
        managerApprovedAt: new Date('2026-08-06'),
      },
    });
  }

  const katoClaim = await prisma.expense.findFirst({ where: { companyId: agro.id, submittedBy: kato.id, category: 'Travel' } });
  if (!katoClaim) {
    const claimEntryCount = await prisma.journalEntry.count({ where: { companyId: agro.id } });
    const claimEntryNumber = `JE-${new Date().getFullYear()}-${String(claimEntryCount + 1).padStart(4, '0')}`;
    const paidEntry = await prisma.journalEntry.create({
      data: {
        companyId: agro.id,
        entryNumber: claimEntryNumber,
        entryDate: new Date('2026-07-20'),
        description: 'Expense claim — Travel (Ronald Kato)',
        financialPeriodId: period.id,
        status: 'posted',
        createdBy: smith.id,
        postedAt: new Date('2026-07-20'),
        items: {
          create: [
            { accountId: travelExpense.id, debitAmount: 90_000, creditAmount: 0, description: 'Expense claim' },
            { accountId: cash.id, debitAmount: 0, creditAmount: 90_000, description: 'Expense claim payment' },
          ],
        },
      },
    });
    await prisma.expense.create({
      data: {
        companyId: agro.id,
        submittedBy: kato.id,
        category: 'Travel',
        description: 'Supplier site visit — AgroChem Uganda Ltd',
        amount: 90_000,
        currency: 'UGX',
        expenseDate: new Date('2026-07-18'),
        receiptReference: 'RCPT-2026-0077',
        expenseAccountId: travelExpense.id,
        status: 'paid',
        managerApprovedBy: kintu.id,
        managerApprovedAt: new Date('2026-07-19'),
        financeApprovedBy: smith.id,
        financeApprovedAt: new Date('2026-07-20'),
        paidBy: smith.id,
        paidAt: new Date('2026-07-20'),
        journalEntryId: paidEntry.id,
      },
    });
  }

  console.log('Seeding demo Auditor user...');
  const nassuna = await prisma.user.upsert({
    where: { email: 's.nassuna@morise-holdings.com' },
    update: {},
    create: {
      email: 's.nassuna@morise-holdings.com',
      passwordHash,
      firstName: 'Susan',
      lastName: 'Nassuna',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: nassuna.id, roleId: rolesByName.get('Auditor')! } },
    update: {},
    create: { userId: nassuna.id, roleId: rolesByName.get('Auditor')! },
  });
  // Auditor role is treated as inherently group-wide for read access to the
  // audit trail (no company scope needed for audit.view itself), but still
  // given a nominal Group scope entry for consistency with every other
  // seeded user and in case a future permission ties audit access to scope.
  await ensureScope(nassuna.id, holding.id, null);

  // ==================== HR Module deepening (19 August 2026) ====================
  console.log('Seeding HR module (Recruitment, Attendance, Leave, Performance) demo data...');

  // Link Kintu (Branch Manager, already a demo login) to a real Employee
  // record — the only way any self-service Attendance/Leave/Performance
  // action is reachable through the demo at all, the same
  // "no seeded user could reach this" gap Sprint 2 found for company
  // management. Reuses Kintu's existing persona rather than adding a new
  // login, keeping the demo credential list from growing further.
  const kintuEmployee = await prisma.employee.upsert({
    where: { companyId_employeeNumber: { companyId: agro.id, employeeNumber: 'EMP-0003' } },
    update: { userId: kintu.id },
    create: {
      companyId: agro.id,
      branchId: 'b1000000-0000-4000-8000-000000000001',
      employeeNumber: 'EMP-0003',
      firstName: 'Peter',
      lastName: 'Kintu',
      jobTitle: 'Branch Manager',
      employmentStartDate: new Date('2022-04-01'),
      userId: kintu.id,
    },
  });

  const dayShift = await prisma.shift.upsert({
    where: { id: 'c1000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: 'c1000000-0000-4000-8000-000000000001', companyId: agro.id, name: 'Day Shift', startTime: '08:00', endTime: '17:00', graceMinutes: 15 },
  });
  await prisma.employee.update({ where: { id: kintuEmployee.id }, data: { shiftId: dayShift.id } });
  if (grace) await prisma.employee.update({ where: { id: grace.id }, data: { shiftId: dayShift.id } });
  if (david) await prisma.employee.update({ where: { id: david.id }, data: { shiftId: dayShift.id } });

  // Leave balances for 2026 — Uganda Employment Act-informed defaults
  // (21 days annual, the rest reasonable round numbers this codebase has
  // no authoritative source for beyond "a leave type needs some
  // entitlement to be demonstrable at all").
  const leaveEntitlements: Record<string, number> = { annual: 21, sick: 10, maternity: 90, paternity: 4, emergency: 5 };
  for (const emp of [kintuEmployee, grace, david].filter((e): e is NonNullable<typeof e> => !!e)) {
    for (const [leaveType, entitledDays] of Object.entries(leaveEntitlements)) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveType_year: { employeeId: emp.id, leaveType: leaveType as any, year: 2026 } },
        update: {},
        create: { employeeId: emp.id, leaveType: leaveType as any, year: 2026, entitledDays },
      });
    }
  }
  // Two applications at different lifecycle stages, same pattern Sprint 9/
  // 11 used for expenses/assets: one still awaiting approval (a live
  // target for "Approve"/"Reject"), one already approved (with its
  // balance's usedDays correctly incremented).
  if (grace) {
    const existingLeave = await prisma.leaveApplication.findFirst({ where: { employeeId: grace.id, leaveType: 'annual', status: 'submitted' } });
    if (!existingLeave) {
      await prisma.leaveApplication.create({
        data: {
          employeeId: grace.id,
          companyId: agro.id,
          leaveType: 'annual',
          startDate: new Date('2026-09-07'),
          endDate: new Date('2026-09-11'),
          daysRequested: 5,
          reason: 'Family function upcountry.',
          status: 'submitted',
          submittedBy: kintu.id,
        },
      });
    }
  }
  if (david) {
    const existingApproved = await prisma.leaveApplication.findFirst({ where: { employeeId: david.id, leaveType: 'sick', status: 'approved' } });
    if (!existingApproved) {
      await prisma.leaveApplication.create({
        data: {
          employeeId: david.id,
          companyId: agro.id,
          leaveType: 'sick',
          startDate: new Date('2026-07-14'),
          endDate: new Date('2026-07-15'),
          daysRequested: 2,
          reason: 'Flu.',
          status: 'approved',
          submittedBy: david.userId ?? kintu.id,
          approvedBy: nakato.id,
          approvedAt: new Date('2026-07-14'),
        },
      });
      await prisma.leaveBalance.update({
        where: { employeeId_leaveType_year: { employeeId: david.id, leaveType: 'sick', year: 2026 } },
        data: { usedDays: { increment: 2 } },
      });
    }
  }

  // Recruitment: one vacancy carried through the full funnel — applied ->
  // shortlisted -> interviewed (scored) -> offered -> accepted -> onboarded
  // — demonstrating the funnel actually closes into a real Employee
  // record, plus a second application still early in the pipeline as a
  // live target for "Shortlist"/"Reject".
  let vacancy = await prisma.jobVacancy.findFirst({ where: { companyId: agro.id, title: 'Field Agronomist' } });
  if (!vacancy) {
    vacancy = await prisma.jobVacancy.create({
      data: {
        companyId: agro.id,
        branchId: 'b1000000-0000-4000-8000-000000000001',
        title: 'Field Agronomist',
        description: 'Advise on crop health and yield optimization across Morise Agro Ltd\'s contracted farms.',
        employmentType: 'full_time',
        numberOfPositions: 1,
        status: 'open',
        postedDate: new Date('2026-07-01'),
        closingDate: new Date('2026-08-31'),
        createdBy: nakato.id,
        approvedBy: kintu.id,
        approvedAt: new Date('2026-07-01'),
      },
    });

    const applicantOne = await prisma.jobApplication.create({
      data: { vacancyId: vacancy.id, applicantName: 'Brenda Achieng', applicantEmail: 'b.achieng@example.com', applicantPhone: '+256700111222', cvReference: 'CV-2026-0091', status: 'applied' },
    });

    const applicantTwo = await prisma.jobApplication.create({
      data: {
        vacancyId: vacancy.id,
        applicantName: 'Moses Tumwine',
        applicantEmail: 'm.tumwine@example.com',
        applicantPhone: '+256700333444',
        cvReference: 'CV-2026-0092',
        status: 'offered',
      },
    });
    const interview = await prisma.interview.create({
      data: {
        applicationId: applicantTwo.id,
        scheduledAt: new Date('2026-07-20T10:00:00Z'),
        interviewerEmployeeId: kintuEmployee.id,
        mode: 'in_person',
        status: 'completed',
        score: 82,
        notes: 'Strong agronomy background, good references.',
        createdBy: nakato.id,
      },
    });
    const offer = await prisma.jobOffer.create({
      data: {
        applicationId: applicantTwo.id,
        offeredSalary: 2_800_000,
        currency: 'UGX',
        proposedStartDate: new Date('2026-09-01'),
        status: 'accepted',
        issuedBy: nakato.id,
        respondedAt: new Date('2026-07-25'),
      },
    });
    void applicantOne;
    void interview;
    void offer;
  }

  // Performance: one review cycle, three reviews at three different
  // lifecycle stages — the same "three stages at once" seeding pattern
  // Sprint 11 used for assets.
  let cycle = await prisma.performanceReviewCycle.findFirst({ where: { companyId: agro.id, name: '2026 H2 Review' } });
  if (!cycle) {
    cycle = await prisma.performanceReviewCycle.create({
      data: { companyId: agro.id, name: '2026 H2 Review', startDate: new Date('2026-07-01'), endDate: new Date('2026-12-31'), status: 'open' },
    });
    if (grace) {
      await prisma.performanceObjective.create({
        data: { cycleId: cycle.id, employeeId: grace.id, title: 'Grow Morise Agro Ltd sales revenue', targetValue: '15% growth vs H1 2026', weight: 60, status: 'pending' },
      });
      await prisma.performanceReview.create({
        data: { cycleId: cycle.id, employeeId: grace.id, companyId: agro.id, managerEmployeeId: kintuEmployee.id, status: 'self_assessment_pending' },
      });
    }
    if (david) {
      await prisma.performanceReview.create({
        data: {
          cycleId: cycle.id,
          employeeId: david.id,
          companyId: agro.id,
          managerEmployeeId: kintuEmployee.id,
          selfAssessment: 'Kept warehouse stock discrepancies near zero all quarter; completed forklift safety recertification.',
          selfAssessmentAt: new Date('2026-08-10'),
          status: 'manager_review_pending',
        },
      });
    }
    await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: kintuEmployee.id,
        companyId: agro.id,
        selfAssessment: 'Held branch expense approvals to a 24-hour turnaround; onboarded two new hires this half.',
        selfAssessmentAt: new Date('2026-08-05'),
        managerAssessment: 'Consistently reliable branch leadership; ready for broader scope.',
        managerRating: 4,
        promotionRecommended: true,
        trainingRecommendation: 'Advanced people-management training ahead of a potential regional role.',
        status: 'completed',
        completedAt: new Date('2026-08-12'),
      },
    });
  }

  // HR Dashboard + Departments screens (28 August 2026): give Morise Agro
  // Ltd a small department structure, put the three demo employees in it,
  // and seed recent attendance plus an upcoming contract end and an
  // approved upcoming leave, so the HR Dashboard has live figures to show.
  console.log('Seeding HR Dashboard demo data (departments, recent attendance, upcoming events) (28 August 2026)...');
  const agroDepts: Record<string, string> = {};
  for (const [id, name, description] of [
    ['d1000000-0000-4000-8000-000000000040', 'Field Operations', 'Agronomy and field advisory teams.'],
    ['d1000000-0000-4000-8000-000000000041', 'Finance & Administration', 'Accounts, payroll and office administration.'],
    ['d1000000-0000-4000-8000-000000000042', 'Warehouse & Distribution', 'Inputs storage, dispatch and stock control.'],
  ] as const) {
    const existing = await prisma.department.findFirst({ where: { companyId: agro.id, name } });
    const dept = existing ?? (await prisma.department.create({ data: { id, companyId: agro.id, name, description } }));
    agroDepts[name] = dept.id;
  }
  await prisma.employee.update({ where: { id: kintuEmployee.id }, data: { departmentId: agroDepts['Field Operations'], contractType: 'permanent', grossSalary: 2_800_000, payFrequency: 'monthly' } });
  if (grace) await prisma.employee.update({ where: { id: grace.id }, data: { departmentId: agroDepts['Warehouse & Distribution'], contractType: 'permanent', grossSalary: 1_600_000, payFrequency: 'monthly' } });
  if (david)
    await prisma.employee.update({
      where: { id: david.id },
      // A fixed-term contract ending ~3 weeks out — a live row for the HR
      // Dashboard's "contracts ending" list.
      data: {
        departmentId: agroDepts['Finance & Administration'],
        contractType: 'fixed_term',
        employmentEndDate: new Date(Date.now() + 21 * 86_400_000),
        grossSalary: 1_200_000,
        payFrequency: 'monthly',
      },
    });

  // ~3 working weeks of attendance for the three employees ending today,
  // with a realistic scatter of late / absent days.
  const attendanceEmployees = [kintuEmployee, grace, david].filter((e): e is NonNullable<typeof e> => !!e);
  for (let back = 1; back <= 21; back++) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - back);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // weekends
    for (let i = 0; i < attendanceEmployees.length; i++) {
      const emp = attendanceEmployees[i];
      const seed = (back * 7 + i * 3) % 20;
      const status = seed === 0 ? 'absent' : seed <= 3 ? 'late' : seed === 4 ? 'half_day' : 'present';
      const already = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: day } },
      });
      if (!already) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            companyId: agro.id,
            date: day,
            status: status as any,
            lateMinutes: status === 'late' ? 10 + seed * 5 : 0,
            clockInTime: status === 'absent' ? null : new Date(day.getTime() + (8 * 60 + (status === 'late' ? 25 : 2)) * 60_000),
            clockOutTime: status === 'absent' ? null : new Date(day.getTime() + (status === 'half_day' ? 13 : 17) * 3_600_000),
            recordedBy: kintu.id,
          },
        });
      }
    }
  }

  // An approved leave starting ~10 days out — a row for "leave starting soon".
  const upcomingLeaveStart = new Date(Date.now() + 10 * 86_400_000);
  const upcomingLeaveEnd = new Date(Date.now() + 14 * 86_400_000);
  const existingUpcomingLeave = await prisma.leaveApplication.findFirst({
    where: { employeeId: kintuEmployee.id, status: 'approved', startDate: { gte: new Date() } },
  });
  if (!existingUpcomingLeave) {
    await prisma.leaveApplication.create({
      data: {
        employeeId: kintuEmployee.id,
        companyId: agro.id,
        leaveType: 'annual',
        startDate: upcomingLeaveStart,
        endDate: upcomingLeaveEnd,
        daysRequested: 3,
        reason: 'Pre-planned annual leave.',
        status: 'approved',
        submittedBy: kintu.id,
        approvedBy: nakato.id,
        approvedAt: new Date(),
      },
    });
  }

  // Shift Scheduling + Payroll (28 August 2026): a published roster for last
  // week, a planned roster for next week, and one approved salary advance so
  // the two new screens have live content.
  console.log('Seeding Shift Scheduling roster + Payroll salary advance demo data (28 August 2026)...');
  for (const [emp, weekOffset, publish] of [
    [kintuEmployee, 0, true],
    [grace, 0, true],
    [david, 0, true],
    [kintuEmployee, 1, false],
    [grace, 1, false],
  ] as const) {
    if (!emp) continue;
    const monday = new Date();
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + weekOffset * 7);
    for (let d = 0; d < 5; d++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + d);
      const exists = await prisma.rosterEntry.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
      if (!exists) {
        await prisma.rosterEntry.create({
          data: {
            companyId: agro.id,
            employeeId: emp.id,
            shiftId: dayShift.id,
            date,
            status: publish ? 'published' : 'planned',
            publishedAt: publish ? new Date() : null,
            createdBy: nakato.id,
          },
        });
      }
    }
  }

  if (grace) {
    const existingAdvance = await prisma.salaryAdvance.findFirst({ where: { employeeId: grace.id } });
    if (!existingAdvance) {
      await prisma.salaryAdvance.create({
        data: {
          companyId: agro.id,
          employeeId: grace.id,
          employeeName: `${grace.firstName} ${grace.lastName}`,
          amount: 600_000,
          reason: 'School fees for the term.',
          installments: 3,
          status: 'approved',
          requestedBy: nakato.id,
          approvedBy: mathias.id,
          approvedAt: new Date(),
        },
      });
    }
  }

  // Salary structures (1 September 2026): demo Morise Agro Ltd employees get a
  // salary structure (basic + allowances) plus a one-off item for the current
  // month, so a payroll run shows an earnings breakdown per payslip. Each
  // structure sums to the employee's existing grossSalary; the one-off item is
  // extra for that month only.
  {
    const nowY = new Date().getUTCFullYear();
    const nowM = new Date().getUTCMonth() + 1;
    type Comp = { type: 'basic' | 'allowance' | 'overtime' | 'bonus'; label: string; amount: number };
    const structures: Array<{ employeeId: string; recurring: Comp[]; oneOff: Comp }> = [];
    if (grace)
      structures.push({
        employeeId: grace.id,
        recurring: [
          { type: 'basic', label: 'Basic salary', amount: 1_000_000 },
          { type: 'allowance', label: 'Housing allowance', amount: 350_000 },
          { type: 'allowance', label: 'Transport allowance', amount: 250_000 },
        ],
        oneOff: { type: 'overtime', label: `Overtime — ${nowM}/${nowY}`, amount: 180_000 },
      });
    structures.push({
      employeeId: kintuEmployee.id,
      recurring: [
        { type: 'basic', label: 'Basic salary', amount: 1_800_000 },
        { type: 'allowance', label: 'Housing allowance', amount: 600_000 },
        { type: 'allowance', label: 'Transport allowance', amount: 400_000 },
      ],
      oneOff: { type: 'bonus', label: `Performance bonus — ${nowM}/${nowY}`, amount: 500_000 },
    });
    for (const s of structures) {
      const has = await prisma.salaryComponent.findFirst({ where: { employeeId: s.employeeId } });
      if (has) continue;
      for (const c of s.recurring) {
        await prisma.salaryComponent.create({
          data: { companyId: agro.id, employeeId: s.employeeId, type: c.type, label: c.label, amount: c.amount, recurring: true, createdBy: nakato.id },
        });
      }
      await prisma.salaryComponent.create({
        data: {
          companyId: agro.id,
          employeeId: s.employeeId,
          type: s.oneOff.type,
          label: s.oneOff.label,
          amount: s.oneOff.amount,
          recurring: false,
          periodYear: nowY,
          periodMonth: nowM,
          createdBy: nakato.id,
        },
      });
    }
  }

  // My HR self-service (28 August 2026): every seeded staff login is given a
  // linked Employee record so the self-service screens work for whichever
  // demo persona is signed in — not only Peter Kintu. Each also gets a 2026
  // leave-balance set; the ones in Morise Agro Ltd get the Day Shift and a
  // published roster for the current week.
  console.log('Linking demo staff logins to employee records (My HR self-service) (28 August 2026)...');
  const staffEmployeeSpecs: Array<{
    user: typeof mathias;
    companyId: string;
    number: string;
    jobTitle: string;
    departmentId?: string;
    gross: number;
    start: string;
    shift?: string;
  }> = [
    { user: mathias, companyId: holding.id, number: 'EMP-H001', jobTitle: 'Managing Director', gross: 12_000_000, start: '2019-01-01' },
    { user: godfrey, companyId: holding.id, number: 'EMP-H002', jobTitle: 'IT Administrator', departmentId: 'd1000000-0000-4000-8000-000000000002', gross: 6_500_000, start: '2020-03-01' },
    { user: nassuna, companyId: holding.id, number: 'EMP-H003', jobTitle: 'Internal Auditor', departmentId: 'd1000000-0000-4000-8000-000000000001', gross: 5_800_000, start: '2021-06-01' },
    { user: nakato, companyId: agro.id, number: 'EMP-0010', jobTitle: 'Human Resources Manager', departmentId: agroDepts['Finance & Administration'], gross: 4_200_000, start: '2021-02-01', shift: dayShift.id },
    { user: smith, companyId: agro.id, number: 'EMP-0011', jobTitle: 'Finance Manager', departmentId: agroDepts['Finance & Administration'], gross: 4_800_000, start: '2020-09-01', shift: dayShift.id },
    { user: namuli, companyId: agro.id, number: 'EMP-0012', jobTitle: 'Sales Manager', departmentId: agroDepts['Field Operations'], gross: 3_900_000, start: '2022-01-15', shift: dayShift.id },
    { user: kato, companyId: agro.id, number: 'EMP-0013', jobTitle: 'Procurement Manager', departmentId: agroDepts['Warehouse & Distribution'], gross: 3_700_000, start: '2022-05-01', shift: dayShift.id },
  ];
  for (const spec of staffEmployeeSpecs) {
    const u = spec.user;
    const emp = await prisma.employee.upsert({
      where: { companyId_employeeNumber: { companyId: spec.companyId, employeeNumber: spec.number } },
      update: {
        userId: u.id,
        jobTitle: spec.jobTitle,
        departmentId: spec.departmentId ?? null,
        shiftId: spec.shift ?? null,
        grossSalary: spec.gross,
        payFrequency: 'monthly',
      },
      create: {
        companyId: spec.companyId,
        userId: u.id,
        employeeNumber: spec.number,
        firstName: u.firstName,
        lastName: u.lastName,
        jobTitle: spec.jobTitle,
        employmentStartDate: new Date(spec.start),
        contractType: 'permanent',
        departmentId: spec.departmentId ?? null,
        shiftId: spec.shift ?? null,
        grossSalary: spec.gross,
        payFrequency: 'monthly',
      },
    });
    for (const [leaveType, entitledDays] of Object.entries({ annual: 21, sick: 10, maternity: 90, paternity: 4, emergency: 5 })) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveType_year: { employeeId: emp.id, leaveType: leaveType as any, year: 2026 } },
        update: {},
        create: { employeeId: emp.id, leaveType: leaveType as any, year: 2026, entitledDays },
      });
    }
    if (spec.shift) {
      const monday = new Date();
      monday.setUTCHours(0, 0, 0, 0);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      for (let d = 0; d < 5; d++) {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + d);
        const exists = await prisma.rosterEntry.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
        if (!exists) {
          await prisma.rosterEntry.create({
            data: { companyId: spec.companyId, employeeId: emp.id, shiftId: spec.shift, date, status: 'published', publishedAt: new Date(), createdBy: nakato.id },
          });
        }
      }
    }
  }

  // ==================== Financial Module deepening (19 August 2026) ====================
  console.log('Seeding Financial Module (Accounts Payable, Accounts Receivable, Budget, Reconciliation) demo data...');

  const apAccount = await prisma.account.findFirst({ where: { companyId: agro.id, accountCode: '2000' } });
  const cogsAccount = await prisma.account.findFirst({ where: { companyId: agro.id, accountCode: '5000' } });
  const agroChemSupplier = await prisma.supplier.findFirst({ where: { companyId: agro.id, name: 'AgroChem Uganda Ltd' } });

  if (apAccount && cogsAccount && agroChemSupplier) {
    // Invoice 1 — still pending_approval: a live demo target for "Approve".
    const existingPending = await prisma.supplierInvoice.findFirst({ where: { companyId: agro.id, invoiceNumber: 'AP-2026-0001' } });
    if (!existingPending) {
      await prisma.supplierInvoice.create({
        data: {
          companyId: agro.id,
          supplierId: agroChemSupplier.id,
          invoiceNumber: 'AP-2026-0001',
          invoiceDate: new Date('2026-08-10'),
          dueDate: new Date('2026-09-09'),
          currency: 'UGX',
          subtotal: 1_200_000,
          taxAmount: 0,
          totalAmount: 1_200_000,
          status: 'pending_approval',
          apAccountId: apAccount.id,
          expenseAccountId: cogsAccount.id,
          financialPeriodId: period.id,
          createdBy: smith.id,
          items: { create: [{ description: 'NPK Fertilizer — bulk order', quantity: 50, unitPrice: 24_000, lineTotal: 1_200_000 }] },
        },
      });
    }

    // Invoice 2 — approved and partially paid: a live target for
    // recording a further payment, plus a credit note against it.
    const existingApproved = await prisma.supplierInvoice.findFirst({ where: { companyId: agro.id, invoiceNumber: 'AP-2026-0002' } });
    if (!existingApproved) {
      const jeCount1 = await prisma.journalEntry.count({ where: { companyId: agro.id } });
      const je = await prisma.journalEntry.create({
        data: {
          companyId: agro.id,
          entryNumber: `JE-2026-${String(jeCount1 + 1).padStart(4, '0')}`,
          entryDate: new Date('2026-08-05'),
          description: 'Supplier invoice AP-2026-0002 approved',
          financialPeriodId: period.id,
          status: 'posted',
          postedAt: new Date('2026-08-05'),
          createdBy: smith.id,
          items: {
            create: [
              { accountId: cogsAccount.id, debitAmount: 900_000, creditAmount: 0 },
              { accountId: apAccount.id, debitAmount: 0, creditAmount: 900_000 },
            ],
          },
        },
      });
      const invoice2 = await prisma.supplierInvoice.create({
        data: {
          companyId: agro.id,
          supplierId: agroChemSupplier.id,
          invoiceNumber: 'AP-2026-0002',
          invoiceDate: new Date('2026-08-05'),
          dueDate: new Date('2026-09-04'),
          currency: 'UGX',
          subtotal: 900_000,
          taxAmount: 0,
          totalAmount: 900_000,
          amountPaid: 400_000,
          status: 'partially_paid',
          apAccountId: apAccount.id,
          expenseAccountId: cogsAccount.id,
          financialPeriodId: period.id,
          approvedBy: kintu.id,
          approvedAt: new Date('2026-08-05'),
          journalEntryId: je.id,
          createdBy: smith.id,
          items: { create: [{ description: 'Seed stock — bulk order', quantity: 1, unitPrice: 900_000, lineTotal: 900_000 }] },
        },
      });
      const jeCount2 = await prisma.journalEntry.count({ where: { companyId: agro.id } });
      const paymentJe = await prisma.journalEntry.create({
        data: {
          companyId: agro.id,
          entryNumber: `JE-2026-${String(jeCount2 + 1).padStart(4, '0')}`,
          entryDate: new Date('2026-08-12'),
          description: 'Payment to AgroChem Uganda Ltd — invoice AP-2026-0002',
          financialPeriodId: period.id,
          status: 'posted',
          postedAt: new Date('2026-08-12'),
          createdBy: smith.id,
          items: {
            create: [
              { accountId: apAccount.id, debitAmount: 400_000, creditAmount: 0 },
              { accountId: cash.id, debitAmount: 0, creditAmount: 400_000 },
            ],
          },
        },
      });
      await prisma.supplierPayment.create({
        data: {
          companyId: agro.id,
          supplierId: agroChemSupplier.id,
          paymentDate: new Date('2026-08-12'),
          amount: 400_000,
          currency: 'UGX',
          method: 'bank_transfer',
          reference: 'TXN-88213',
          bankAccountId: cash.id,
          journalEntryId: paymentJe.id,
          paidBy: smith.id,
          applications: { create: [{ invoiceId: invoice2.id, amountApplied: 400_000 }] },
        },
      });
    }
  }

  // Budget: FY2026-Q1 Cost of Goods Sold, a live target for "Budget vs Actual".
  if (cogsAccount) {
    await prisma.budget.upsert({
      where: { financialPeriodId_accountId: { financialPeriodId: period.id, accountId: cogsAccount.id } },
      update: {},
      create: { companyId: agro.id, financialPeriodId: period.id, accountId: cogsAccount.id, budgetedAmount: 700_000, createdBy: smith.id },
    });
  }

  // Reconciliation: Cash and Bank as of a date shortly after the payment
  // above — a small, realistic variance (an unrecorded bank charge),
  // reconciled status, demonstrating the full flow, not just an empty form.
  const existingReconciliation = await prisma.accountReconciliation.findFirst({ where: { companyId: agro.id, accountId: cash.id, asOfDate: new Date('2026-08-15') } });
  if (!existingReconciliation) {
    const ledgerItems = await prisma.journalEntryItem.findMany({ where: { accountId: cash.id, journalEntry: { companyId: agro.id, status: 'posted', entryDate: { lte: new Date('2026-08-15') } } } });
    const ledgerBalance = ledgerItems.reduce((s, i) => s + Number(i.debitAmount) - Number(i.creditAmount), 0);
    const statementBalance = ledgerBalance - 15_000; // an unrecorded bank charge, a realistic small variance
    await prisma.accountReconciliation.create({
      data: {
        companyId: agro.id,
        accountId: cash.id,
        asOfDate: new Date('2026-08-15'),
        statementBalance,
        ledgerBalance,
        variance: statementBalance - ledgerBalance,
        notes: 'UGX 15,000 bank charge on the statement not yet recorded in the ledger.',
        status: 'reconciled',
        reconciledBy: smith.id,
        reconciledAt: new Date('2026-08-16'),
        createdBy: smith.id,
      },
    });
  }

  // AR credit note — against a Customer Storefront invoice (Sprint 16), if
  // one exists for Morise Agro Ltd, demonstrating AR building on the real
  // Invoice/Order system rather than a competing one.
  const salesRevenueAccount = await prisma.account.findFirst({ where: { companyId: agro.id, accountCode: '4000' } });
  const anyInvoice = await prisma.invoice.findFirst({ where: { companyId: agro.id } });
  if (salesRevenueAccount && anyInvoice) {
    const existingArCreditNote = await prisma.customerCreditNote.findFirst({ where: { companyId: agro.id, creditNoteNumber: 'ARCN-2026-0001' } });
    if (!existingArCreditNote) {
      const arAccount = await prisma.account.findFirst({ where: { companyId: agro.id, accountSubType: 'receivable' } });
      if (arAccount) {
        const jeCount3 = await prisma.journalEntry.count({ where: { companyId: agro.id } });
        const je = await prisma.journalEntry.create({
          data: {
            companyId: agro.id,
            entryNumber: `JE-2026-${String(jeCount3 + 1).padStart(4, '0')}`,
            entryDate: new Date('2026-08-14'),
            description: 'Customer credit note ARCN-2026-0001',
            financialPeriodId: period.id,
            status: 'posted',
            postedAt: new Date('2026-08-14'),
            createdBy: smith.id,
            items: {
              create: [
                { accountId: salesRevenueAccount.id, debitAmount: 25_000, creditAmount: 0 },
                { accountId: arAccount.id, debitAmount: 0, creditAmount: 25_000 },
              ],
            },
          },
        });
        await prisma.customerCreditNote.create({
          data: {
            companyId: agro.id,
            customerId: anyInvoice.customerId,
            creditNoteNumber: 'ARCN-2026-0001',
            creditDate: new Date('2026-08-14'),
            amount: 25_000,
            reason: 'Damaged goods on delivery — partial refund.',
            appliedToInvoiceId: anyInvoice.id,
            status: 'applied',
            financialPeriodId: period.id,
            journalEntryId: je.id,
            createdBy: smith.id,
          },
        });
      }
    }
  }

  console.log('\nSeed complete.');
  console.log('Demo login credentials (local dev only):');
  console.log(`  Managing Director  m.okurut@morise-holdings.com / ${DEMO_PASSWORD}`);
  console.log(`  IT Administrator   g.obeke@morise-holdings.com  / ${DEMO_PASSWORD}`);
  console.log(`  Branch Manager     p.kintu@morise-holdings.com  / ${DEMO_PASSWORD}  (scoped to Morise Agro Ltd only)`);
  console.log(`  HR Manager         m.nakato@morise-holdings.com / ${DEMO_PASSWORD}  (scoped to both Morise Agro Ltd and Morise Logistics Ltd)`);
  console.log(`  Finance Manager    a.smith@morise-holdings.com  / ${DEMO_PASSWORD}  (scoped to Morise Agro Ltd only)`);
  console.log(`  Sales Manager      s.namuli@morise-holdings.com / ${DEMO_PASSWORD}  (scoped to Morise Agro Ltd only)`);
  console.log(`  Procurement Manager r.kato@morise-holdings.com  / ${DEMO_PASSWORD}  (scoped to Morise Agro Ltd only)`);
  console.log(`  Auditor            s.nassuna@morise-holdings.com / ${DEMO_PASSWORD}  (read-only, group-wide)`);
  console.log(`  Customer Portal    accounts@highlandtraders.co.ug or CUST-0118 / ${DEMO_PASSWORD}  (Highland Traders Ltd, buying from Morise Agro Ltd)`);
}

async function ensureScope(userId: string, companyId: string, branchId: string | null) {
  const existing = await prisma.userScope.findFirst({ where: { userId, companyId, branchId } });
  if (!existing) {
    await prisma.userScope.create({ data: { userId, companyId, branchId } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
