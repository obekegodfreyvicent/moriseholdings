// Sprint 16 (Customer Storefront). Deliberately a second, separate principal
// shape from AuthenticatedUser (src/common/strategies/jwt.strategy.ts) — a
// Customer is not a User, has no roles/permissions, and this type is never
// checked by PermissionsGuard/RequirePermission (staff-only). Customer
// portal authorization is simpler by construction: "is this the caller's
// own record", not RBAC.
export interface CustomerJwtPayload {
  sub: string;
}

export interface AuthenticatedCustomer {
  id: string;
  companyId: string;
  name: string;
  accountNumber: string | null;
  contactEmail: string | null;
}
