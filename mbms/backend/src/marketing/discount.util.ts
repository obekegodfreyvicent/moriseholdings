// Marketing & Promos (28 August 2026). Pure evaluation of a discount code
// against an order subtotal — no database access, so both the storefront
// validate endpoint (MarketingService) and the order-placement path
// (OrdersService) can share exactly one rule set.
//
// Content localisation (28 August 2026): each outcome carries a stable
// `messageKey` (and, where relevant, `messageParams`) so the storefront can
// render the reason in the customer's chosen language; `reason` is the
// English fallback string used server-side (e.g. the 409 on order placement).

export interface DiscountCodeLike {
  code: string;
  discountType: 'percentage' | 'fixed';
  value: unknown; // Prisma Decimal | number | string
  minOrderValue?: unknown | null;
  maxRedemptions?: number | null;
  timesRedeemed: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status: 'active' | 'inactive';
}

export interface DiscountEvaluation {
  ok: boolean;
  reason?: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  discountAmount: number; // whole currency units, already capped at the subtotal
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export function evaluateDiscountCode(
  row: DiscountCodeLike | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): DiscountEvaluation {
  if (!row) return { ok: false, reason: 'That code is not recognised.', messageKey: 'discount.unknown', discountAmount: 0 };
  if (row.status !== 'active') return { ok: false, reason: 'That code is no longer active.', messageKey: 'discount.inactive', discountAmount: 0 };
  if (row.startsAt && now < row.startsAt) return { ok: false, reason: 'That code is not valid yet.', messageKey: 'discount.notYet', discountAmount: 0 };
  if (row.endsAt && now > row.endsAt) return { ok: false, reason: 'That code has expired.', messageKey: 'discount.expired', discountAmount: 0 };
  if (row.maxRedemptions !== null && row.maxRedemptions !== undefined && row.timesRedeemed >= row.maxRedemptions) {
    return { ok: false, reason: 'That code has reached its redemption limit.', messageKey: 'discount.limit', discountAmount: 0 };
  }
  const minOrder = num(row.minOrderValue);
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      ok: false,
      reason: `This code needs a subtotal of at least ${minOrder.toLocaleString()}.`,
      messageKey: 'discount.minOrder',
      messageParams: { amount: minOrder },
      discountAmount: 0,
    };
  }

  let discount =
    row.discountType === 'percentage'
      ? Math.round((subtotal * num(row.value)) / 100)
      : Math.round(num(row.value));
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal; // never below zero

  if (discount === 0) return { ok: false, reason: 'That code gives no discount on this order.', messageKey: 'discount.zero', discountAmount: 0 };
  return { ok: true, messageKey: 'discount.applied', discountAmount: discount };
}
