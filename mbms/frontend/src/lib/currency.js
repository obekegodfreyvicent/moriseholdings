// Currency display (20 August 2026): every amount in this system is
// recorded and posted in UGX (or, for a handful of records, another
// currency code stored verbatim — no multi-currency conversion happens
// anywhere in the ledger itself, the same honest gap the accounting
// reports' consolidation logic already documents). This is a DISPLAY-ONLY
// USD equivalent, computed client-side from a fixed rate — there is no
// live FX-rate integration in this proof-of-concept, and none was asked
// for; a real deployment would source this from a rates provider or the
// accounting system's own configured rate, not a hardcoded constant.
export const UGX_PER_USD = 3800;

export function usdEquivalent(ugxAmount) {
  const n = Number(ugxAmount);
  if (!Number.isFinite(n)) return null;
  return n / UGX_PER_USD;
}

function formatNumber(n, opts) {
  return Number(n).toLocaleString(undefined, opts ?? { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renders "UGX 1,200,000.00 (≈ $315.79)" for UGX amounts, or just
// "<amount> <currency>" for anything recorded in a different currency —
// converting a non-UGX figure through a UGX/USD rate would be wrong, not
// just imprecise, so this deliberately doesn't attempt it.
export function formatMoney(amount, currency = 'UGX') {
  if (amount === undefined || amount === null || amount === '') return '—';
  if (currency !== 'UGX') return `${formatNumber(amount)} ${currency}`;
  const usd = usdEquivalent(amount);
  return `UGX ${formatNumber(amount)} (≈ $${formatNumber(usd)})`;
}
