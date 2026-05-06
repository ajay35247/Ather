import {
  LOCALES,
  INDIAN_LOCALES,
  WORLD_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COUNT,
  MESSAGES,
  getLocale,
  isLocale,
  isRtl,
  resolveLocale,
  pluralCategory,
  t,
  makeT,
  type LocaleCode,
  type MessageKey
} from '../src/index';

describe('locale registry', () => {
  it('has 31 locales: 22 Indian + 9 world (English + 8)', () => {
    expect(LOCALE_COUNT).toBe(31);
    expect(INDIAN_LOCALES.length).toBe(22);
    expect(WORLD_LOCALES.length).toBe(9); // en + 8 world
  });

  it('every locale has the required fields', () => {
    for (const l of LOCALES) {
      expect(l.code).toMatch(/^[a-z]{2,3}$/);
      expect(typeof l.englishName).toBe('string');
      expect(l.englishName.length).toBeGreaterThan(0);
      expect(typeof l.nativeName).toBe('string');
      expect(l.nativeName.length).toBeGreaterThan(0);
      expect(['ltr', 'rtl']).toContain(l.dir);
    }
  });

  it('codes are unique', () => {
    const codes = LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('Urdu, Kashmiri and Arabic are RTL', () => {
    expect(isRtl('ur')).toBe(true);
    expect(isRtl('ks')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('hi')).toBe(false);
    expect(isRtl('en')).toBe(false);
  });

  it('all 22 Eighth-Schedule languages are present', () => {
    const expected = [
      'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'gom', 'mai',
      'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta',
      'te', 'ur'
    ];
    for (const code of expected) {
      const l = getLocale(code);
      expect(l).not.toBeNull();
      expect(l!.indian).toBe(true);
    }
  });
});

describe('getLocale / isLocale', () => {
  it('accepts BCP-47 region tags like pa-IN', () => {
    expect(getLocale('pa-IN')?.code).toBe('pa');
    expect(getLocale('zh_CN')?.code).toBe('zh');
    expect(getLocale('PT-BR')?.code).toBe('pt');
  });

  it('returns null for unknown', () => {
    expect(getLocale('xx')).toBeNull();
    expect(getLocale('')).toBeNull();
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('hi')).toBe(true);
  });
});

describe('translation lookup', () => {
  const KEY: MessageKey = 'heroTitle';

  it('English returns the canonical string', () => {
    expect(t('en', KEY)).toBe('Ather — Your Social OS');
  });

  it('Hindi returns its translation', () => {
    expect(t('hi', KEY)).toBe('Ather — आपका सोशल OS');
  });

  it('falls back to English when key is missing in target locale', () => {
    // 'tagline' is intentionally only set in English in messages.ts for
    // most non-English locales. Confirm fallback works.
    expect(t('mni', 'tagline')).toBe(t('en', 'tagline'));
    expect(t('sat', 'tagline')).toBe(t('en', 'tagline'));
  });

  it('falls back when given an unknown locale', () => {
    expect(t('xx', KEY)).toBe(t('en', KEY));
  });

  it('every locale resolves every key without returning undefined', () => {
    const keys: MessageKey[] = [
      'tagline', 'heroTitle', 'heroSub', 'heroLead', 'bharatFirst',
      'featuresHeading', 'featuresSub', 'chooseLanguage',
      'languagesSupported', 'madeIn', 'seeArchitecture',
      'quietHours', 'activeHours', 'morning', 'afternoon', 'evening',
      'hello', 'sampleEarnings', 'compliance', 'timezone', 'upiPsps'
    ];
    for (const l of LOCALES) {
      for (const k of keys) {
        const v = t(l.code, k);
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it('makeT binds a locale', () => {
    const tr = makeT('ta');
    expect(tr('hello')).toBe('வணக்கம்');
    expect(tr('heroTitle')).toBe('Ather — உங்கள் சமூக OS');
  });

  it('every Indian locale provides a native hello', () => {
    for (const l of INDIAN_LOCALES) {
      const hello = t(l.code, 'hello');
      // Must not be the English fallback "Hello" (we hand-translated all 22).
      expect(hello).not.toBe('Hello');
    }
  });
});

describe('messages table integrity', () => {
  it('is keyed by every supported locale', () => {
    for (const l of LOCALES) {
      expect(MESSAGES[l.code]).toBeDefined();
    }
  });

  it('English table has every documented key', () => {
    const en = MESSAGES.en as Record<string, string>;
    const required = [
      'tagline', 'heroTitle', 'heroSub', 'heroLead', 'bharatFirst',
      'featuresHeading', 'featuresSub', 'chooseLanguage',
      'languagesSupported', 'madeIn', 'seeArchitecture',
      'quietHours', 'activeHours', 'morning', 'afternoon', 'evening',
      'hello', 'sampleEarnings', 'compliance', 'timezone', 'upiPsps'
    ];
    for (const k of required) {
      expect(en[k]).toBeDefined();
      expect(en[k].length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLocale', () => {
  it('parses Accept-Language header and picks first match', () => {
    expect(resolveLocale('hi-IN,hi;q=0.9,en;q=0.8')).toBe('hi');
    expect(resolveLocale('xx,bn-IN;q=0.7')).toBe('bn');
    expect(resolveLocale('xx,yy')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
  });
});

describe('pluralCategory', () => {
  it('English: 1 → one, others → other', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 0)).toBe('other');
    expect(pluralCategory('en', 2)).toBe('other');
  });

  it('French: 0 and 1 → one', () => {
    expect(pluralCategory('fr', 0)).toBe('one');
    expect(pluralCategory('fr', 1)).toBe('one');
    expect(pluralCategory('fr', 2)).toBe('other');
  });

  it('Chinese / Japanese: always other', () => {
    for (const code of ['zh', 'ja'] as LocaleCode[]) {
      expect(pluralCategory(code, 0)).toBe('other');
      expect(pluralCategory(code, 1)).toBe('other');
      expect(pluralCategory(code, 5)).toBe('other');
    }
  });
});
