import { PrismaService } from '../prisma/prisma.service';

/**
 * Storefront group catalogue (29 August 2026).
 *
 * Resolve the whole holding group a company belongs to: walk up
 * `parentCompanyId` to the root holding company, then collect the root plus
 * every active subsidiary beneath it. Used by the customer storefront so one
 * shop lists the products of every Morise subsidiary, not only the
 * customer's own selling company.
 *
 * The hierarchy in this system is one level deep (holding -> subsidiaries),
 * but the walk-up / collect-down is written generally so a deeper tree still
 * resolves correctly.
 */
export async function resolveHoldingGroupCompanyIds(
  prisma: PrismaService,
  companyId: string,
): Promise<string[]> {
  // 1. Walk up to the root (the company with no parent).
  let rootId = companyId;
  const seen = new Set<string>();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (seen.has(rootId)) break; // cycle guard — should never happen
    seen.add(rootId);
    const c = await prisma.company.findUnique({
      where: { id: rootId },
      select: { parentCompanyId: true },
    });
    if (!c || !c.parentCompanyId) break;
    rootId = c.parentCompanyId;
  }

  // 2. Collect the root plus all active descendants (BFS).
  const groupIds = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.company.findMany({
      where: { parentCompanyId: { in: frontier }, status: 'active' },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !groupIds.has(id));
    frontier.forEach((id) => groupIds.add(id));
  }
  return [...groupIds];
}

/** The root holding company's id + name for a given company. */
export async function resolveHoldingCompany(
  prisma: PrismaService,
  companyId: string,
): Promise<{ id: string; name: string }> {
  let current = companyId;
  const seen = new Set<string>();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (seen.has(current)) break;
    seen.add(current);
    const c = await prisma.company.findUnique({
      where: { id: current },
      select: { id: true, name: true, parentCompanyId: true },
    });
    if (!c) break;
    if (!c.parentCompanyId) return { id: c.id, name: c.name };
    current = c.parentCompanyId;
  }
  const fallback = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  return fallback;
}
