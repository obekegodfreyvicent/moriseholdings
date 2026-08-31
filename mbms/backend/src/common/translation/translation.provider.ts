// Machine-translation seam for free-form text (product descriptions,
// support-ticket bodies, address lines that aren't in the glossary).
//
// The default IdentityTranslationProvider returns text unchanged — this
// proof-of-concept has no outbound network and no translation service. Wire a
// real provider (DeepL, an LLM, a self-hosted model) by implementing this
// interface and registering it in ContentTranslationService; select it with
// CONTENT_TRANSLATION_PROVIDER in the environment.

export interface TranslationProvider {
  readonly name: string;
  /** Translate English (or `sourceHint`) text into `target` (a supported code). */
  toLanguage(text: string, target: string, sourceHint?: string): string | Promise<string>;
  /** Translate `sourceHint`-language text into English. */
  toEnglish(text: string, sourceHint?: string): string | Promise<string>;
}

/** No-op provider — leaves free-form text exactly as given. */
export class IdentityTranslationProvider implements TranslationProvider {
  readonly name = 'identity';
  toLanguage(text: string): string {
    return text;
  }
  toEnglish(text: string): string {
    return text;
  }
}
