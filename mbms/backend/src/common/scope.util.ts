import { AuthenticatedUser } from './strategies/jwt.strategy';

/**
 * BR-01 (SRS): a user's visible data reflects their role and company/branch
 * scope automatically — the UI/API never requires the caller to remember to
 * filter to "just my data" (18_UI-UX Design, Section 2).
 *
 * groupPermissionCode is parameterized because each service defines its own
 * "group-wide visibility" permission (organization.company.viewAll,
 * employee.viewAll, accounting.viewAll, ...) rather than sharing one flag —
 * a user can have Group-wide company visibility without also having
 * Group-wide financial visibility, for example.
 */
export function hasGroupVisibility(
  user: AuthenticatedUser,
  groupPermissionCode = 'organization.company.viewAll',
): boolean {
  return user.permissions.includes(groupPermissionCode);
}

export function isCompanyInScope(
  user: AuthenticatedUser,
  companyId: string,
  groupPermissionCode = 'organization.company.viewAll',
): boolean {
  if (hasGroupVisibility(user, groupPermissionCode)) return true;
  return user.scopes.some((s) => s.companyId === companyId);
}
