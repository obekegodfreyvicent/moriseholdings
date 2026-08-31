import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, LANGUAGE_LIST, LOCALES, TRANSLATED_LANGS, dirForLang } from '../locales';

// Customer Storefront localisation (27 August 2026) — a customer chooses the
// language the storefront is shown in, from Uganda's languages. The choice
// is remembered per browser (localStorage 'storefront.lang'); a key with no
// translation for the chosen language falls back to English so the page is
// never half-blank.

const STORAGE_KEY = 'storefront.lang';
const I18nContext = createContext(undefined);

function readInitialLang() {
  // An explicit ?lang= on the URL wins and is persisted — so a localised
  // link (e.g. to the disclaimer gate or landing page) opens in that
  // language for a first-time visitor.
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && LOCALES[q]) {
      try {
        localStorage.setItem(STORAGE_KEY, q);
      } catch {
        /* best-effort */
      }
      return q;
    }
  } catch {
    /* no window (tests) */
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  // First visit, no stored choice: honour the browser's preferred languages
  // (navigator.languages / navigator.language), matched against the base
  // code we ship a table for — so e.g. a Swahili or French browser lands on
  // its own language on the disclaimer gate and landing page. The picker
  // still overrides and persists the visitor's explicit choice.
  try {
    const prefs = (navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || '']) || [];
    for (const p of prefs) {
      const base = String(p).toLowerCase().split('-')[0];
      if (base && base !== DEFAULT_LANG && LOCALES[base] && Object.keys(LOCALES[base]).length > 0) {
        return base;
      }
    }
  } catch {
    /* no navigator (tests) */
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readInitialLang);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      // Right-to-left scripts (Arabic, and any rtl language added later) flip
      // the whole document; left-to-right is restored for every other choice.
      document.documentElement.dir = dirForLang(lang);
    } catch {
      /* no document (tests) */
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LOCALES[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* best-effort */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const table = LOCALES[lang] || {};
      let value = key in table ? table[key] : LOCALES[DEFAULT_LANG][key];
      if (value === undefined) value = key;
      if (vars) {
        for (const [name, v] of Object.entries(vars)) {
          value = value.split(`{${name}}`).join(String(v));
        }
      }
      return value;
    },
    [lang],
  );

  // Translate a raw status / priority enum (e.g. "out_for_delivery") via a
  // `status.*` / `priority.*` key, falling back to the old humanised form
  // (UPPER CASE, underscores → spaces) for any enum not in the catalogue.
  const tEnum = useCallback(
    (prefix, raw) => {
      if (raw == null) return '';
      const key = `${prefix}.${raw}`;
      const table = LOCALES[lang] || {};
      if (key in table) return table[key];
      if (key in LOCALES[DEFAULT_LANG]) return LOCALES[DEFAULT_LANG][key];
      return String(raw).replace(/_/g, ' ').toUpperCase();
    },
    [lang],
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      tStatus: (s) => tEnum('status', s),
      tPriority: (p) => tEnum('priority', p),
      languages: LANGUAGE_LIST,
      translatedLangs: TRANSLATED_LANGS,
    }),
    [lang, setLang, t, tEnum],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Convenience: just the translate function. */
export function useT() {
  return useI18n().t;
}
