import React, { useMemo } from 'react';
import { useI18n } from '../lib/i18n';

// Customer Storefront localisation (27 August 2026) — the language picker.
// Renders every Uganda language, grouped by family; the ones that already
// ship translations are marked, the rest show "(English for now)" so the
// customer knows what to expect. Usable before sign-in too (Landing / Login).
export function LanguageSwitcher({ compact = false }) {
  const { lang, setLang, languages, translatedLangs, t } = useI18n();

  const groups = useMemo(() => {
    const byRegion = new Map();
    for (const l of languages) {
      if (!byRegion.has(l.region)) byRegion.set(l.region, []);
      byRegion.get(l.region).push(l);
    }
    return [...byRegion.entries()];
  }, [languages]);

  return (
    <label className={`sf-lang${compact ? ' sf-lang-compact' : ''}`}>
      <span className="sf-lang-icon" aria-hidden="true">🌐</span>
      <span className="sf-lang-label">{t('header.language')}</span>
      <select
        className="sf-lang-select"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label={t('header.language')}
      >
        {groups.map(([region, list]) => (
          <optgroup key={region} label={region}>
            {list.map((l) => (
              <option key={l.code} value={l.code}>
                {l.localName}
                {l.localName !== l.label ? ` (${l.label})` : ''}
                {translatedLangs.includes(l.code) ? '' : ' — English for now'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
