import { Injectable, Logger } from '@nestjs/common';
import {
  GLOSSARY_LANGS,
  GlossaryLang,
  PHRASES,
  PHRASES_REVERSE,
  TOKENS,
  TOKENS_REVERSE,
  toLocaleDigits,
  toWesternDigits,
} from './content-glossary';
import { IdentityTranslationProvider, TranslationProvider } from './translation.provider';

const SUPPORTED = new Set<string>(GLOSSARY_LANGS);
// Splits a value into translatable word runs and the separators between them,
// so "Maize Seed — 25kg Bag" round-trips (only "Maize", "Seed", "Bag" are
// looked up; "—", "25kg", spaces are preserved).
const TOKEN_SPLIT = /([A-Za-zÀ-ÿ؀-ۿ]+)/;

export interface ToEnglishResult {
  english: string;
  changed: boolean;
}

/**
 * Content localisation (27 August 2026).
 *
 * READ  — toLocale(text, lang): render a stored (English) database value in
 *         the customer's language, as far as the curated glossary reaches;
 *         free-form remainder passes through the TranslationProvider.
 * WRITE — toEnglish(text, sourceLang): normalise customer-typed text to
 *         English before it is stored, again via the glossary + provider.
 *
 * The glossary covers the finite storefront vocabulary (category names,
 * units, address words, product-name tokens). Arbitrary prose is left to the
 * provider, whose default implementation is a no-op — documented in
 * translation.provider.ts.
 */
@Injectable()
export class ContentTranslationService {
  private readonly logger = new Logger(ContentTranslationService.name);
  private readonly provider: TranslationProvider;

  constructor() {
    const name = process.env.CONTENT_TRANSLATION_PROVIDER || 'identity';
    // Only the identity provider is bundled. A deployment adds real providers
    // to this switch.
    switch (name) {
      case 'identity':
      default:
        this.provider = new IdentityTranslationProvider();
    }
    if (name !== 'identity') {
      this.logger.warn(`Unknown CONTENT_TRANSLATION_PROVIDER "${name}" — falling back to identity (no-op).`);
    }
  }

  /** Map an Accept-Language header (or a raw code) to a supported code, else 'en'. */
  resolveLang(headerOrCode: string | undefined | null): string {
    if (!headerOrCode) return 'en';
    const first = headerOrCode.split(',')[0]?.trim().toLowerCase() || '';
    const base = first.split('-')[0];
    if (base === 'en') return 'en';
    return SUPPORTED.has(base) ? base : 'en';
  }

  isSupported(lang: string): lang is GlossaryLang {
    return SUPPORTED.has(lang);
  }

  // ------------------------------- READ -------------------------------
  toLocale(text: string | null | undefined, lang: string): string | null | undefined {
    if (text == null || text === '' || lang === 'en' || !this.isSupported(lang)) return text;
    const exact = PHRASES[text.trim()]?.[lang];
    if (exact) return toLocaleDigits(exact, lang);
    const tokened = this.mapTokens(text, (w) => TOKENS[w.toLowerCase()]?.[lang]);
    // Anything the glossary didn't touch goes to the provider (no-op by
    // default); then any digits in the result are rendered in the language's
    // own script (e.g. "25kg" -> "٢٥kg" for Arabic).
    const translated = tokened === text ? String(this.provider.toLanguage(text, lang)) : tokened;
    return toLocaleDigits(translated, lang);
  }

  /** Translate every string value in `obj` at the given keys, in place-safe copy. */
  localiseFields<T extends Record<string, any>>(obj: T, lang: string, keys: (keyof T)[]): T {
    if (lang === 'en' || !this.isSupported(lang)) return obj;
    const out: any = { ...obj };
    for (const k of keys) if (typeof out[k] === 'string') out[k] = this.toLocale(out[k], lang);
    return out;
  }

  // ------------------------------- WRITE -------------------------------
  toEnglish(text: string | null | undefined, sourceLang: string): ToEnglishResult {
    if (text == null || text === '') return { english: '', changed: false };
    // Numerals a customer typed in a non-Western script are always
    // normalised to 0-9, even for an otherwise-unsupported language.
    const western = toWesternDigits(text as string);
    if (sourceLang === 'en' || !this.isSupported(sourceLang)) {
      return { english: western, changed: western !== text };
    }
    const src = western;
    const rev = PHRASES_REVERSE[sourceLang]?.[src.trim().toLocaleLowerCase()];
    if (rev) return { english: rev, changed: rev !== text };
    const tokened = this.mapTokens(src, (w) => TOKENS_REVERSE[sourceLang]?.[w.toLocaleLowerCase()]);
    if (tokened !== src) return { english: tokened, changed: true };
    const viaProvider = String(this.provider.toEnglish(src, sourceLang));
    return { english: viaProvider, changed: viaProvider !== text };
  }

  // ------------------------------- internal -------------------------------
  private mapTokens(text: string, lookup: (word: string) => string | undefined): string {
    return text
      .split(TOKEN_SPLIT)
      .map((part) => (TOKEN_SPLIT.test(part) ? lookup(part) ?? part : part))
      .join('');
  }
}
