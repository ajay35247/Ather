/**
 * @ather/i18n — multi-language support for Ather.
 *
 * Locale set: all 22 Eighth-Schedule Indian languages + 8 major world
 * languages (30 total). Translation tables are partial; missing keys
 * fall back to English.
 */

import {
  type Locale,
  type LocaleCode,
  DEFAULT_LOCALE,
  LOCALES,
  INDIAN_LOCALES,
  WORLD_LOCALES,
  getLocale,
  isLocale,
  isRtl
} from './locales';
import { ENGLISH_MESSAGES, MESSAGES, type MessageKey } from './messages';

export {
  LOCALES,
  INDIAN_LOCALES,
  WORLD_LOCALES,
  DEFAULT_LOCALE,
  getLocale,
  isLocale,
  isRtl
};
export type { Locale, LocaleCode, MessageKey };
export { MESSAGES };

/**
 * Look up a translation string. Falls back to English if the locale
 * doesn't translate this key. Returns the key as a last-resort safety
 * net so the UI never shows `undefined`.
 */
export function t(locale: LocaleCode | string, key: MessageKey): string {
  const code = typeof locale === 'string' ? (getLocale(locale)?.code ?? DEFAULT_LOCALE) : DEFAULT_LOCALE;
  const table = MESSAGES[code];
  const v = table?.[key];
  if (typeof v === 'string' && v.length > 0) return v;
  const fallback = ENGLISH_MESSAGES[key];
  return typeof fallback === 'string' ? fallback : key;
}

/**
 * Build a function bound to a single locale. Useful in components:
 *   const tr = makeT('hi'); tr('heroTitle');
 */
export function makeT(locale: LocaleCode | string): (key: MessageKey) => string {
  const code: LocaleCode =
    typeof locale === 'string' ? (getLocale(locale)?.code ?? DEFAULT_LOCALE) : DEFAULT_LOCALE;
  return (key) => t(code, key);
}

/**
 * Best-effort browser-language → supported-locale resolver.
 * Accepts an Accept-Language header value or a single tag like `pa-IN`.
 * Returns `DEFAULT_LOCALE` if nothing matches.
 */
export function resolveLocale(input: string | undefined | null): LocaleCode {
  if (!input || typeof input !== 'string') return DEFAULT_LOCALE;
  const tags = input
    .split(',')
    .map((s) => s.trim().split(';')[0]!.toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    const l = getLocale(tag);
    if (l) return l.code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Minimal CLDR-style plural category selector. We only distinguish
 * `one` vs `other`; that's enough for almost every UI string we have.
 *
 * For locales like Chinese / Japanese / Vietnamese that have no plural
 * distinction, we always return `other`.
 */
export function pluralCategory(
  locale: LocaleCode | string,
  n: number
): 'one' | 'other' {
  const code: LocaleCode =
    typeof locale === 'string' ? (getLocale(locale)?.code ?? DEFAULT_LOCALE) : DEFAULT_LOCALE;
  const noPlural: ReadonlySet<LocaleCode> = new Set<LocaleCode>(['zh', 'ja']);
  if (noPlural.has(code)) return 'other';
  // French treats 0 and 1 as singular; most others only 1.
  const oneIncludesZero: ReadonlySet<LocaleCode> = new Set<LocaleCode>(['fr']);
  const abs = Math.abs(n);
  if (oneIncludesZero.has(code)) return abs < 2 ? 'one' : 'other';
  return abs === 1 ? 'one' : 'other';
}

/** Number of locales currently registered. */
export const LOCALE_COUNT: number = LOCALES.length;
