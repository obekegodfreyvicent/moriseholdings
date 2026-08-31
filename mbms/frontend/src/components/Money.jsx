import React from 'react';
import { usdEquivalent } from '../lib/currency';

// Shared money display (20 August 2026): "UGX 1,200,000.00" with a muted
// "(≈ $315.79)" USD equivalent alongside it — see lib/currency.js for the
// fixed display-rate this converts with, and why it's fixed rather than
// live. Amounts recorded in a currency other than UGX render as-is, no
// conversion attempted.
export function Money({ value, currency = 'UGX', className, mono = true }) {
  if (value === undefined || value === null || value === '') return <span className={className}>—</span>;
  const n = Number(value);
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (currency !== 'UGX') {
    return (
      <span className={`${mono ? 'mono' : ''} ${className ?? ''}`}>
        {formatted} {currency}
      </span>
    );
  }

  const usd = usdEquivalent(n);
  return (
    <span className={className}>
      <span className={mono ? 'mono' : ''}>UGX {formatted}</span>
      <span style={{ opacity: 0.6, fontSize: '0.9em', marginLeft: 5 }} className={mono ? 'mono' : ''}>
        (≈ ${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
      </span>
    </span>
  );
}
