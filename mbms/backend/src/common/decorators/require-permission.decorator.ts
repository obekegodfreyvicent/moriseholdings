import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * FORBIDDEN (403) per 09_API Specification, Section 2.5, if the
 * authenticated user's roles do not grant this permission code.
 * Also recorded as an access_denied audit event once the Audit &
 * Reporting Service exists (deferred to a later sprint per the
 * Recommended Development Order).
 *
 * Pass multiple codes for "any of" semantics — e.g. a read endpoint that
 * should open to either a group-wide "viewAll" permission or the narrower
 * "manage" permission that also implies read access within scope.
 */
export const RequirePermission = (...permissionCodes: string[]) => SetMetadata(PERMISSION_KEY, permissionCodes);
