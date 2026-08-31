// Fixed demo conversion rates — this environment has no live FX feed (the
// same "simulated, no real gateway" honesty that applies to payments), so
// every conversion below is a single constant, not a fabricated live rate.
// UGX_PER_USD is kept equal to mbms/frontend/src/lib/currency.js's own
// constant (3800) — separate bundles, duplicated by hand.
const UGX_PER_USD = 3800;

// Figure / currency localisation (27 August 2026): amounts come from the API
// in UGX. When the customer has chosen a language whose region uses another
// currency, the amount is CONVERTED and formatted for that locale — value,
// grouping, decimal mark and digit script all follow it (e.g. UGX 96,000 →
// "٩٣٫٨٨ درهم إماراتي" in Arabic, "23,13 €" in French). Uganda's languages
// keep UGX. Rates are fixed demo constants (UGX per 1 unit).
const UGX_PER_UNIT = { UGX: 1, USD: UGX_PER_USD, EUR: 4150, AED: 1022, BRL: 700 };
const CURRENCY_BY_LANG = { ar: 'AED', fr: 'EUR', es: 'EUR', de: 'EUR', it: 'EUR', pt: 'BRL' };
// BCP-47 tag for Intl formatting (value, separators AND digit script).
const LOCALE_TAG = { ar: 'ar-AE', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-BR', sw: 'sw', lg: 'en', en: 'en-US' };

function currentLang() {
  try {
    return localStorage.getItem('storefront.lang') || 'en';
  } catch {
    return 'en';
  }
}

function localeTag(lang = currentLang()) {
  return LOCALE_TAG[lang] || 'en-US';
}

export function usdEquivalent(amount) {
  return Number(amount) / UGX_PER_USD;
}

// Format an integer (quantities, counts, stock) in the current language —
// digit script and grouping follow the locale.
export function figure(n) {
  return new Intl.NumberFormat(localeTag()).format(Number(n) || 0);
}

// Re-render any string that contains ASCII digits in the current language's
// digit script (e.g. a product name carrying "25kg"). No-op for languages
// that use 0-9.
export function localizeDigits(text) {
  const fmt = new Intl.NumberFormat(localeTag(), { useGrouping: false });
  return String(text).replace(/[0-9]+/g, (run) => fmt.format(Number(run)));
}

export function money(amount) {
  const n = Number(amount) || 0;
  const lang = currentLang();
  const currency = CURRENCY_BY_LANG[lang];

  if (!currency || currency === 'UGX') {
    // Canonical presentation — unchanged for English and Uganda's languages.
    const ugx = `UGX ${new Intl.NumberFormat(localeTag(lang)).format(Math.round(n))}`;
    const usd = usdEquivalent(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${ugx} (≈ $${usd})`;
  }

  const converted = n / UGX_PER_UNIT[currency];
  try {
    return new Intl.NumberFormat(localeTag(lang), {
      style: 'currency',
      currency,
      currencyDisplay: 'name',
      maximumFractionDigits: 2,
    }).format(converted);
  } catch {
    return `${converted.toFixed(2)} ${currency}`;
  }
}

export function statusLabel(status) {
  return String(status).replace(/_/g, ' ').toUpperCase();
}

// Shared across order/invoice/ticket statuses — a small enough mapping
// that one function covering all three (rather than three near-identical
// ones) reads better.
export function statusBadgeClass(status) {
  switch (status) {
    case 'delivered':
    case 'paid':
    case 'resolved':
      return 'sf-badge-success';
    case 'out_for_delivery':
    case 'packed':
    case 'confirmed':
    case 'placed':
    case 'due_soon':
    case 'awaiting_reply':
      return 'sf-badge-warning';
    case 'cancelled':
    case 'overdue':
      return 'sf-badge-error';
    default:
      return 'sf-badge-neutral';
  }
}
