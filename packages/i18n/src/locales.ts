/**
 * Locale registry for Ather.
 *
 * Indian languages: all 22 from the Eighth Schedule of the Constitution of
 * India (in the order they appear in the schedule).
 *
 * World languages: 8 widely-used additional locales chosen to cover the
 * top non-Indian language communities globally.
 *
 * Adding a new locale: append an entry here AND a translation table in
 * messages.ts. The runtime falls back to English for any missing key, so
 * partial coverage is safe.
 */

export type LocaleCode =
  // World
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ru'
  | 'ar'
  | 'zh'
  | 'ja'
  // Indian — Eighth Schedule (22)
  | 'as'
  | 'bn'
  | 'brx'
  | 'doi'
  | 'gu'
  | 'hi'
  | 'kn'
  | 'ks'
  | 'gom'
  | 'mai'
  | 'ml'
  | 'mni'
  | 'mr'
  | 'ne'
  | 'or'
  | 'pa'
  | 'sa'
  | 'sat'
  | 'sd'
  | 'ta'
  | 'te'
  | 'ur';

export type LocaleScript =
  | 'Latin'
  | 'Devanagari'
  | 'Bengali'
  | 'Gujarati'
  | 'Gurmukhi'
  | 'Tamil'
  | 'Telugu'
  | 'Kannada'
  | 'Malayalam'
  | 'Oriya'
  | 'PersoArabic'
  | 'Arabic'
  | 'Meitei'
  | 'OlChiki'
  | 'Han'
  | 'Cyrillic'
  | 'Japanese';

export type LocaleDir = 'ltr' | 'rtl';

/** Plural categories per CLDR. We use a minimal subset (one / other). */
export type PluralCategory = 'one' | 'other';

export interface Locale {
  code: LocaleCode;
  /** English display name. */
  englishName: string;
  /** Endonym (the language's own name). */
  nativeName: string;
  script: LocaleScript;
  dir: LocaleDir;
  /** Whether this is an Eighth-Schedule Indian language. */
  indian: boolean;
}

export const LOCALES: readonly Locale[] = Object.freeze([
  // ---------- World ----------
  { code: 'en', englishName: 'English', nativeName: 'English', script: 'Latin', dir: 'ltr', indian: false },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', script: 'Latin', dir: 'ltr', indian: false },
  { code: 'fr', englishName: 'French', nativeName: 'Français', script: 'Latin', dir: 'ltr', indian: false },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch', script: 'Latin', dir: 'ltr', indian: false },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português', script: 'Latin', dir: 'ltr', indian: false },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский', script: 'Cyrillic', dir: 'ltr', indian: false },
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية', script: 'Arabic', dir: 'rtl', indian: false },
  { code: 'zh', englishName: 'Chinese (Simplified)', nativeName: '中文', script: 'Han', dir: 'ltr', indian: false },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語', script: 'Japanese', dir: 'ltr', indian: false },

  // ---------- Indian (Eighth Schedule, 22) ----------
  { code: 'as', englishName: 'Assamese', nativeName: 'অসমীয়া', script: 'Bengali', dir: 'ltr', indian: true },
  { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', script: 'Bengali', dir: 'ltr', indian: true },
  { code: 'brx', englishName: 'Bodo', nativeName: 'बड़ो', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'doi', englishName: 'Dogri', nativeName: 'डोगरी', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati', dir: 'ltr', indian: true },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada', dir: 'ltr', indian: true },
  { code: 'ks', englishName: 'Kashmiri', nativeName: 'كٲشُر', script: 'PersoArabic', dir: 'rtl', indian: true },
  { code: 'gom', englishName: 'Konkani', nativeName: 'कोंकणी', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'mai', englishName: 'Maithili', nativeName: 'मैथिली', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam', dir: 'ltr', indian: true },
  { code: 'mni', englishName: 'Manipuri (Meitei)', nativeName: 'ꯃꯩꯇꯩꯂꯣꯟ', script: 'Meitei', dir: 'ltr', indian: true },
  { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'ne', englishName: 'Nepali', nativeName: 'नेपाली', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Oriya', dir: 'ltr', indian: true },
  { code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', dir: 'ltr', indian: true },
  { code: 'sa', englishName: 'Sanskrit', nativeName: 'संस्कृतम्', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'sat', englishName: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'OlChiki', dir: 'ltr', indian: true },
  { code: 'sd', englishName: 'Sindhi', nativeName: 'सिन्धी', script: 'Devanagari', dir: 'ltr', indian: true },
  { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil', dir: 'ltr', indian: true },
  { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu', dir: 'ltr', indian: true },
  { code: 'ur', englishName: 'Urdu', nativeName: 'اُردُو', script: 'PersoArabic', dir: 'rtl', indian: true }
]) as readonly Locale[];

const LOCALE_BY_CODE: Readonly<Record<LocaleCode, Locale>> = (() => {
  const m = Object.create(null) as Record<LocaleCode, Locale>;
  for (const l of LOCALES) m[l.code] = l;
  return Object.freeze(m);
})();

export const DEFAULT_LOCALE: LocaleCode = 'en';

export function getLocale(code: string): Locale | null {
  if (typeof code !== 'string') return null;
  const c = code.toLowerCase().split(/[-_]/)[0];
  return (LOCALE_BY_CODE as Record<string, Locale>)[c] ?? null;
}

export function isLocale(code: string): code is LocaleCode {
  return getLocale(code) !== null;
}

export function isRtl(code: LocaleCode): boolean {
  return LOCALE_BY_CODE[code].dir === 'rtl';
}

/** Indian Schedule-8 locales, in schedule order. */
export const INDIAN_LOCALES: readonly Locale[] = Object.freeze(
  LOCALES.filter((l) => l.indian)
);

/** Non-Indian locales. */
export const WORLD_LOCALES: readonly Locale[] = Object.freeze(
  LOCALES.filter((l) => !l.indian)
);
