/**
 * Translate command input: an optional target language prefix, then the text.
 * `:xx` accepts any two-letter code; a bare `xx` only a known one, so text starting
 * with a short word ("Le chat", "Un jour") is not mistaken for a language.
 */
export class TranslationQuery {
  private static readonly LANGUAGE_NAMES: Readonly<Record<string, string>> = {
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    ja: "Japanese",
    ko: "Korean",
    nl: "Dutch",
    pl: "Polish",
    pt: "Portuguese",
    ru: "Russian",
    zh: "Chinese",
  };
  private static readonly PREFIX = /^(:?)([a-zA-Z]{2})\s+(.+)$/s;

  readonly lang: string;
  /** Full language name when known, the code otherwise. */
  readonly languageName: string;
  readonly text: string;

  constructor(query: string, defaultLang: string) {
    const match = TranslationQuery.PREFIX.exec(query);
    const lang = match?.[2].toLowerCase() ?? "";
    const explicit = match?.[1] === ":";

    if (match && (explicit || lang in TranslationQuery.LANGUAGE_NAMES)) {
      this.lang = lang;
      this.text = match[3];
    } else {
      this.lang = defaultLang;
      this.text = query;
    }
    this.languageName = TranslationQuery.LANGUAGE_NAMES[this.lang] ?? this.lang;
  }
}
