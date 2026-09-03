// Visibility model (27 August 2026) — "an admin user who has not been
// granted an operation shouldn't even see it."
//
// Each admin route maps to the permission code(s) that make it meaningful.
// A user sees the nav item / may open the route iff:
//   • the entry is '*' (always — dashboard and the My HR self-service set), OR
//   • they hold identity.user.manage (platform admin — Super Administrator /
//     IT Administrator — administers the whole system), OR
//   • they hold at least one of the listed codes.
//
// '__platform_admin__' means "platform admin only" — used for planned
// screens that have no permission code of their own yet (e.g. Payroll).
//
// The same map drives nav filtering in Layout.jsx and the <RequireCapability>
// route guard in App.jsx, so the two can never drift.
export const ROUTE_CAPABILITIES = {
  // Always visible
  '/dashboard': '*',
  '/profile': '*',
  '/my/clock': '*',
  '/my/leave': '*',
  '/my/shifts': '*',
  '/my/performance': '*',
  '/my/payslips': '*',
  '/my/id-card': '*',
  '/my/salary-advances': '*',

  // Admin / Backend
  '/companies': ['organization.company.manage', 'organization.company.viewAll'],
  '/products': ['product.manage', 'product.viewAll'],
  '/orders': ['sales.order.manage', 'sales.order.viewAll'],
  '/inventory': ['product.manage', 'product.viewAll'],
  '/fleet': ['fleet.manage', 'fleet.viewAll'],
  '/customers': ['customer.manage', 'customer.viewAll'],
  '/support-tickets': ['support.ticket.manage', 'support.ticket.viewAll'],
  '/marketing': ['marketing.manage', 'marketing.viewAll'],
  '/cms': ['cms.manage', 'cms.viewAll'],
  '/social': ['social.post.manage', 'social.post.publish', 'social.post.viewAll'],
  '/users': ['identity.user.manage', 'identity.user.delegate'],
  '/audit': ['audit.view'],

  // Human Resources
  '/hr': ['employee.viewAll', 'recruitment.viewAll', 'attendance.viewAll', 'leave.viewAll', 'performance.viewAll'],
  '/employees': ['employee.manage', 'employee.viewAll'],
  '/staff-id-cards': ['employee.idcard.manage', 'employee.idcard.viewAll'],
  '/departments': ['organization.company.manage', 'organization.company.viewAll', 'employee.viewAll', 'recruitment.viewAll'],
  '/attendance': ['attendance.manage', 'attendance.viewAll'],
  '/leave': ['leave.manage', 'leave.approve', 'leave.viewAll'],
  '/shift-scheduling': ['attendance.manage', 'attendance.viewAll'],
  '/recruitment': ['recruitment.manage', 'recruitment.approve', 'recruitment.viewAll'],
  '/payroll': ['payroll.manage', 'payroll.approve', 'payroll.viewAll'],

  // Financial & Accounting
  '/finance': [
    'accounting.manage',
    'accounting.viewAll',
    'ap.manage',
    'ap.approve',
    'ap.viewAll',
    'expense.viewAll',
    'expense.approve.finance',
    'asset.manage',
    'asset.viewAll',
    'project.manage',
    'project.viewAll',
    'supplier.manage',
    'supplier.viewAll',
    'organization.intercompany.manage',
    'organization.intercompany.viewAll',
  ],
  '/accounting': ['accounting.manage', 'accounting.viewAll'],
  '/accounts-payable': ['ap.manage', 'ap.approve', 'ap.viewAll'],
  '/expenses': ['expense.create', 'expense.viewAll', 'expense.approve.manager', 'expense.approve.finance'],
  '/assets': ['asset.manage', 'asset.viewAll', 'asset.approve.disposal'],
  '/projects': ['project.manage', 'project.viewAll'],
  '/reports': ['accounting.viewAll', 'expense.viewAll', 'asset.viewAll', 'project.viewAll', 'sales.order.viewAll', 'ap.viewAll'],
  '/suppliers': ['supplier.manage', 'supplier.viewAll'],
  '/inter-company': ['organization.intercompany.manage', 'organization.intercompany.viewAll'],
};

export function heldPermissions(user) {
  return (user && Array.isArray(user.permissions) && user.permissions) || [];
}

export function isPlatformAdmin(user) {
  return heldPermissions(user).includes('identity.user.manage');
}

/** True when `user` may see / open `path`. Unknown paths are not hidden. */
export function canSeeRoute(path, user) {
  const caps = ROUTE_CAPABILITIES[path];
  if (caps === undefined || caps === '*') return true;
  if (isPlatformAdmin(user)) return true;
  if (caps.includes('__platform_admin__')) return false;
  const held = heldPermissions(user);
  return caps.some((code) => held.includes(code));
}

/**
 * Route-guard form: match a live pathname (which may carry an id segment,
 * e.g. /companies/<uuid>) against the capability map by exact key or the
 * longest prefix key. Used by <RequireAuth> so a user cannot reach a screen
 * by typing its URL. While the signed-in user's permission list is still
 * loading (a session stored before the field existed), nothing is blocked —
 * the server still enforces every call.
 */
export function canSeeCurrentPath(pathname, user) {
  if (user && !Array.isArray(user.permissions)) return true;
  if (pathname in ROUTE_CAPABILITIES) return canSeeRoute(pathname, user);
  let best = null;
  for (const key of Object.keys(ROUTE_CAPABILITIES)) {
    if (pathname === key || pathname.startsWith(`${key}/`)) {
      if (best === null || key.length > best.length) best = key;
    }
  }
  return best === null ? true : canSeeRoute(best, user);
}
