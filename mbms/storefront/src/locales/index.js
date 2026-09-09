// Customer Storefront localisation — language list + catalogue assembly.
//
// 27 Aug 2026: a customer switches the storefront language from a picker.
// English is the complete key catalogue (locales/en.js); other tables
// translate a subset and fall back to English key by key (see lib/i18n.jsx).
// "Whole storefront" pass (27 Aug 2026): every visible string is keyed.
//
// 9 Sep 2026 (Update 102): the administrator scoped the storefront's
// official language set down to these 9 — the ones already translated in
// full — organised into the groups the administrator specified: Uganda's
// two official languages, a Ugandan Bantu language, an African language,
// and four European languages plus one from the Americas. The larger
// aspirational 43-language list (34 English-fallback placeholders plus two
// partial regional languages) is retired; every remaining language is
// fully translated, so the picker no longer needs an "English for now"
// caveat on any entry.
import { en } from './en';
import { fr, es, pt, de, it } from './eu';
import { sw, lg, ar } from './regional';

export const DEFAULT_LANG = 'en';

// code: ISO 639-1. `dir` defaults to 'ltr'. `region` groups match the
// administrator's official structure (Update 102).
export const LANGUAGE_LIST = [
  { code: 'en', label: 'English', localName: 'English', region: 'Uganda — Official / Global' },
  { code: 'sw', label: 'Swahili', localName: 'Kiswahili', region: 'Uganda — Official / Africa' },
  { code: 'lg', label: 'Luganda', localName: 'Luganda', region: 'Uganda — Bantu' },

  // ---- Africa ----
  { code: 'ar', label: 'Arabic', localName: 'العربية', region: 'Africa', dir: 'rtl' },

  // ---- Europe ----
  { code: 'de', label: 'German', localName: 'Deutsch', region: 'Europe' },
  { code: 'fr', label: 'French', localName: 'Français', region: 'Europe' },
  { code: 'es', label: 'Spanish', localName: 'Español', region: 'Europe' },
  { code: 'it', label: 'Italian', localName: 'Italiano', region: 'Europe' },

  // ---- The Americas ----
  { code: 'pt', label: 'Portuguese', localName: 'Português', region: 'The Americas' },
];

/** Text direction for a language code (default left-to-right). */
export function dirForLang(code) {
  const entry = LANGUAGE_LIST.find((l) => l.code === code);
  return entry && entry.dir === 'rtl' ? 'rtl' : 'ltr';
}

// All 9 official languages ship a complete translation (Update 102).
export const LOCALES = { en, sw, lg, ar, de, fr, es, it, pt };

/** Languages that currently ship at least some translated strings. */
export const TRANSLATED_LANGS = Object.entries(LOCALES)
  .filter(([, table]) => Object.keys(table).length > 0)
  .map(([code]) => code);

/** Languages with a complete (or near-complete) translation of the storefront. */
export const FULLY_TRANSLATED_LANGS = ['en', 'sw', 'lg', 'fr', 'es', 'pt', 'de', 'it', 'ar'];
