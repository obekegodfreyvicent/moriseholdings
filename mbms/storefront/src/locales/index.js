// Customer Storefront localisation — language list + catalogue assembly.
//
// 27 Aug 2026: a customer switches the storefront language from a picker.
// English is the complete key catalogue (locales/en.js); other tables
// translate a subset and fall back to English key by key (see lib/i18n.jsx).
// "Whole storefront" pass (27 Aug 2026): every visible string is now keyed,
// and English, Swahili, Luganda, French, Spanish, Portuguese, German,
// Italian and Arabic are translated in full — choosing one of those changes
// the entire storefront. Arabic is right-to-left (dir: 'rtl').

import { en } from './en';
import { fr, es, pt, de, it } from './eu';
import { sw, lg, ar, nyn, ach } from './regional';

export const DEFAULT_LANG = 'en';

// code: ISO 639-1 where one exists, else ISO 639-3. `dir` defaults to 'ltr'.
export const LANGUAGE_LIST = [
  { code: 'en', label: 'English', localName: 'English', region: 'Uganda — Official / Global' },
  { code: 'sw', label: 'Swahili', localName: 'Kiswahili', region: 'Uganda — Official / Africa' },

  { code: 'lg', label: 'Luganda', localName: 'Luganda', region: 'Uganda — Bantu' },
  { code: 'nyn', label: 'Runyankole', localName: 'Runyankore', region: 'Uganda — Bantu' },
  { code: 'cgg', label: 'Rukiga', localName: 'Rukiga', region: 'Uganda — Bantu' },
  { code: 'xog', label: 'Lusoga', localName: 'Lusoga', region: 'Uganda — Bantu' },
  { code: 'ttj', label: 'Rutooro', localName: 'Rutooro', region: 'Uganda — Bantu' },
  { code: 'myx', label: 'Lumasaba', localName: 'Lumasaaba (Lugisu)', region: 'Uganda — Bantu' },
  { code: 'rw', label: 'Kinyarwanda', localName: 'Ikinyarwanda', region: 'Uganda — Bantu' },

  { code: 'teo', label: 'Ateso', localName: 'Ateso', region: 'Uganda — Nilotic' },
  { code: 'ach', label: 'Acholi', localName: 'Leb Acoli', region: 'Uganda — Nilotic' },
  { code: 'laj', label: 'Lango', localName: 'Leb Lango', region: 'Uganda — Nilotic' },
  { code: 'kdj', label: 'Karamojong', localName: 'ŊaKarimojoŋ', region: 'Uganda — Nilotic' },
  { code: 'alz', label: 'Alur', localName: 'Dho Alur', region: 'Uganda — Nilotic' },
  { code: 'kakwa', label: 'Kakwa', localName: 'Kakwa', region: 'Uganda — Nilotic' },

  { code: 'lgg', label: 'Lugbara', localName: 'Lugbarati', region: 'Uganda — Central Sudanic' },
  { code: 'mhi', label: "Ma'di", localName: "Ma'di", region: 'Uganda — Central Sudanic' },
  { code: 'luc', label: 'Aringa', localName: 'Aringa (Low Lugbara)', region: 'Uganda — Central Sudanic' },

  // ---- Africa ----
  { code: 'ar', label: 'Arabic', localName: 'العربية', region: 'Africa', dir: 'rtl' },
  { code: 'ha', label: 'Hausa', localName: 'Hausa', region: 'Africa' },
  { code: 'yo', label: 'Yoruba', localName: 'Yorùbá', region: 'Africa' },
  { code: 'ig', label: 'Igbo', localName: 'Igbo', region: 'Africa' },
  { code: 'am', label: 'Amharic', localName: 'አማርኛ', region: 'Africa' },
  { code: 'zu', label: 'Zulu', localName: 'isiZulu', region: 'Africa' },

  // ---- Asia ----
  { code: 'zh', label: 'Mandarin Chinese', localName: '中文（普通话）', region: 'Asia' },
  { code: 'hi', label: 'Hindi', localName: 'हिन्दी', region: 'Asia' },
  { code: 'bn', label: 'Bengali', localName: 'বাংলা', region: 'Asia' },
  { code: 'ja', label: 'Japanese', localName: '日本語', region: 'Asia' },
  { code: 'id', label: 'Indonesian', localName: 'Bahasa Indonesia', region: 'Asia' },
  { code: 'ru', label: 'Russian', localName: 'Русский', region: 'Asia / Europe' },
  { code: 'tr', label: 'Turkish', localName: 'Türkçe', region: 'Asia' },

  // ---- Europe ----
  { code: 'de', label: 'German', localName: 'Deutsch', region: 'Europe' },
  { code: 'fr', label: 'French', localName: 'Français', region: 'Europe' },
  { code: 'es', label: 'Spanish', localName: 'Español', region: 'Europe' },
  { code: 'it', label: 'Italian', localName: 'Italiano', region: 'Europe' },

  // ---- The Americas ----
  { code: 'pt', label: 'Portuguese', localName: 'Português', region: 'The Americas' },
  { code: 'qu', label: 'Quechua', localName: 'Runa Simi', region: 'The Americas' },
  { code: 'gn', label: 'Guarani', localName: "Avañe'ẽ", region: 'The Americas' },

  // ---- Oceania ----
  { code: 'tpi', label: 'Tok Pisin', localName: 'Tok Pisin', region: 'Oceania' },
  { code: 'mi', label: 'Maori', localName: 'Te Reo Māori', region: 'Oceania' },
  { code: 'sm', label: 'Samoan', localName: 'Gagana Samoa', region: 'Oceania' },
  { code: 'to', label: 'Tongan', localName: 'Lea faka-Tonga', region: 'Oceania' },
  { code: 'fj', label: 'Fijian', localName: 'Na Vosa Vakaviti', region: 'Oceania' },
];

/** Text direction for a language code (default left-to-right). */
export function dirForLang(code) {
  const entry = LANGUAGE_LIST.find((l) => l.code === code);
  return entry && entry.dir === 'rtl' ? 'rtl' : 'ltr';
}

const empty = {};

export const LOCALES = {
  // Complete
  en,
  // Translated in full
  sw,
  lg,
  fr,
  es,
  pt,
  de,
  it,
  ar,
  // Partial
  nyn,
  ach,
  // Listed — English fallback until translated
  cgg: empty,
  xog: empty,
  ttj: empty,
  myx: empty,
  rw: empty,
  teo: empty,
  laj: empty,
  kdj: empty,
  alz: empty,
  kakwa: empty,
  lgg: empty,
  mhi: empty,
  luc: empty,
  ha: empty,
  yo: empty,
  ig: empty,
  am: empty,
  zu: empty,
  zh: empty,
  hi: empty,
  bn: empty,
  ja: empty,
  id: empty,
  ru: empty,
  tr: empty,
  qu: empty,
  gn: empty,
  tpi: empty,
  mi: empty,
  sm: empty,
  to: empty,
  fj: empty,
};

/** Languages that currently ship at least some translated strings. */
export const TRANSLATED_LANGS = Object.entries(LOCALES)
  .filter(([, table]) => Object.keys(table).length > 0)
  .map(([code]) => code);

/** Languages with a complete (or near-complete) translation of the storefront. */
export const FULLY_TRANSLATED_LANGS = ['en', 'sw', 'lg', 'fr', 'es', 'pt', 'de', 'it', 'ar'];
