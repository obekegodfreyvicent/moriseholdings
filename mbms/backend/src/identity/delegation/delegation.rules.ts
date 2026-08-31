// Delegated-administration model (27 August 2026)
// -------------------------------------------------
// Every admin user may only view / create / update / delete / execute what
// they have been granted, and those grants may only be made — and only
// revoked — by the three business grantor roles below, each within a bounded
// authority:
//
//   • Managing Director        — any permission, any role, group-wide.
//   • Branch Manager           — only "operations"-domain permissions, and
//                                only to users inside their own branch scope.
//   • Human Resources Manager  — only "hr"-domain permissions, within their
//                                own company/branch scope.
//
// Super Administrator and any other holder of `identity.user.manage` keep
// unbounded delegation authority as the platform bootstrap / break-glass
// path (documented in the root README).

export type DelegationDomain =
  | 'identity'
  | 'org'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'governance'
  | 'general';

export type DelegationScopeKind = 'group' | 'own-scope';

export interface DelegationRule {
  /** '*' means every domain; otherwise the exact domains this grantor may delegate. */
  domains: '*' | DelegationDomain[];
  /** 'group' skips the scope check; 'own-scope' requires the target user to sit inside the grantor's own UserScope rows. */
  scope: DelegationScopeKind;
}

/** Keyed by Role.name. A user with several grantor roles gets the union. */
export const DELEGATION_RULES: Record<string, DelegationRule> = {
  'Super Administrator': { domains: '*', scope: 'group' },
  'Managing Director': { domains: '*', scope: 'group' },
  'Branch Manager': { domains: ['operations'], scope: 'own-scope' },
  'Human Resources Manager': { domains: ['hr'], scope: 'own-scope' },
};

/** The permission that lets a user reach the grant/revoke endpoints at all. */
export const DELEGATE_PERMISSION = 'identity.user.delegate';

/** Holders of this permission delegate every domain, group-wide (bootstrap path). */
export const UNBOUNDED_DELEGATION_PERMISSION = 'identity.user.manage';

export interface EffectiveAuthority {
  /** true = every domain allowed. */
  allDomains: boolean;
  domains: Set<DelegationDomain>;
  scope: DelegationScopeKind;
  /** Role names (or the bootstrap permission) this authority was derived from — for error messages. */
  sources: string[];
}

/**
 * Merge every grantor rule that applies to this set of role names / permissions
 * into one effective authority, or null if the user may not delegate at all.
 */
export function effectiveAuthority(roleNames: string[], permissionCodes: string[]): EffectiveAuthority | null {
  if (permissionCodes.includes(UNBOUNDED_DELEGATION_PERMISSION)) {
    return { allDomains: true, domains: new Set(), scope: 'group', sources: [UNBOUNDED_DELEGATION_PERMISSION] };
  }

  const rules = roleNames
    .filter((name) => DELEGATION_RULES[name])
    .map((name) => ({ name, rule: DELEGATION_RULES[name] }));

  if (rules.length === 0) return null;

  if (rules.some((r) => r.rule.domains === '*')) {
    return {
      allDomains: true,
      domains: new Set(),
      scope: 'group',
      sources: rules.map((r) => r.name),
    };
  }

  const domains = new Set<DelegationDomain>();
  for (const r of rules) {
    for (const d of r.rule.domains as DelegationDomain[]) domains.add(d);
  }
  // 'own-scope' unless a rule says 'group' (none of the bounded roles do today).
  const scope: DelegationScopeKind = rules.some((r) => r.rule.scope === 'group') ? 'group' : 'own-scope';

  return { allDomains: false, domains, scope, sources: rules.map((r) => r.name) };
}
