'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  INDIAN_LOCALES,
  WORLD_LOCALES,
  type LocaleCode,
  getLocale,
  isRtl,
  makeT,
  resolveLocale,
  LOCALE_COUNT
} from '@ather/i18n';
import {
  formatINR,
  formatIST,
  istGreeting,
  toHindiAmountWord,
  festivalOn,
  isIndiaBusinessHour,
  KNOWN_UPI_PSPS
} from '@ather/india';

type Feature = {
  title: string;
  titleHi: string;
  description: string;
  status: 'shipping' | 'in-progress' | 'planned';
  pillar: 'creator' | 'safety' | 'ai' | 'bharat' | 'platform';
};

const FEATURES: Feature[] = [
  { title: 'UPI Tipping', titleHi: 'यूपीआई से टिप दीजिए', status: 'in-progress', pillar: 'creator',
    description: 'Tip any creator instantly via UPI VPA. Settles in seconds, no card needed.' },
  { title: 'Bharat Creator Studio', titleHi: 'भारत क्रिएटर स्टूडियो', status: 'in-progress', pillar: 'creator',
    description: 'Earnings in ₹ with lakh/crore, GST-ready invoices, TDS summaries, same-day payouts.' },
  { title: 'Regional-Language Feed', titleHi: 'क्षेत्रीय भाषा फ़ीड', status: 'planned', pillar: 'bharat',
    description: 'First-class feeds in हिन्दी, தமிழ், తెలుగు, বাংলা, मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ.' },
  { title: 'DPDP Teen Mode', titleHi: 'किशोर सुरक्षा मोड', status: 'planned', pillar: 'safety',
    description: 'Default-private under-18 accounts, restricted DMs, screen-time caps, parental linking.' },
  { title: 'IST-Aware Notifications', titleHi: 'समय-संवेदी सूचनाएँ', status: 'shipping', pillar: 'ai',
    description: 'Notifications honour Indian sleep hours; non-urgent posts batch overnight.' },
  { title: 'Festival Themes', titleHi: 'त्यौहार थीम', status: 'shipping', pillar: 'bharat',
    description: 'Auto-themed app for Diwali, Holi, Eid, Onam, Pongal, Republic & Independence Days.' },
  { title: 'Aadhaar / PAN Redaction', titleHi: 'आधार-पैन ऑटो-छिपाव', status: 'shipping', pillar: 'safety',
    description: 'Posts and DMs are scanned client-side; obvious Aadhaar / PAN numbers are masked.' },
  { title: 'GST-Ready Marketplace', titleHi: 'जीएसटी-रेडी बाज़ार', status: 'planned', pillar: 'creator',
    description: 'CGST + SGST or IGST computed automatically; HSN codes, e-invoice JSON, GSTR-1 export.' },
  { title: 'Voice-First Onboarding', titleHi: 'आवाज़ से ऑनबोर्डिंग', status: 'planned', pillar: 'ai',
    description: 'Sign up by speaking — works in 12+ Indian languages, even on entry-level phones.' },
  { title: 'Lite Mode (under 5 MB)', titleHi: 'लाइट मोड', status: 'planned', pillar: 'bharat',
    description: 'A stripped-down app that runs on 2G/3G and ₹5,000 phones.' },
  { title: 'Communities with Treasury', titleHi: 'समुदाय कोष', status: 'planned', pillar: 'creator',
    description: 'Communities collect tips into a shared ₹ treasury and split via on-ledger rules.' },
  { title: 'AI Content Provenance', titleHi: 'एआई सामग्री प्रमाण', status: 'in-progress', pillar: 'safety',
    description: 'Every upload is C2PA-signed at capture. Clear "human / AI-assisted / AI-generated" badges.' },
  { title: 'Mini-Apps (Bharat Stack)', titleHi: 'मिनी-ऐप्स', status: 'planned', pillar: 'platform',
    description: 'Order food, pay bills, book IRCTC tickets, run UPI collect — all sandboxed inside Ather.' },
  { title: 'Personal AI Twin', titleHi: 'आपका एआई जुड़वाँ', status: 'planned', pillar: 'ai',
    description: 'A private model that replies on your behalf in low-stakes group chats. Opt-in, on-device.' },
  { title: 'E2EE DMs', titleHi: 'एंड-टू-एंड एन्क्रिप्टेड DM', status: 'in-progress', pillar: 'safety',
    description: 'Server stores ciphertext only. Sealed-sender metadata, disappearing messages.' },
  { title: 'Cricket & Election Surfaces', titleHi: 'क्रिकेट और चुनाव', status: 'planned', pillar: 'bharat',
    description: 'Live cricket score overlays, ball-by-ball reactions, verified-source labels for elections.' }
];

const PILLAR_CLASS: Record<Feature['pillar'], string> = {
  creator: 'tag',
  safety: 'tag green',
  ai: 'tag blue',
  bharat: 'tag',
  platform: 'tag green'
};

const PILLAR_LABEL: Record<Feature['pillar'], string> = {
  creator: 'Creator',
  safety: 'Safety',
  ai: 'AI',
  bharat: 'Bharat',
  platform: 'Platform'
};

function detectInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem('ather.locale');
    if (saved && getLocale(saved)) return getLocale(saved)!.code;
  } catch {
    // localStorage may be unavailable (private mode); fall through.
  }
  const nav = window.navigator;
  return resolveLocale(nav?.languages?.join(',') || nav?.language);
}

export default function HomePage() {
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [now, setNow] = useState<Date>(() => new Date(0)); // SSR-stable

  // Initial locale + live clock are client-only to avoid hydration mismatch.
  useEffect(() => {
    setLocale(detectInitialLocale());
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Persist locale and apply dir/lang to <html>.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const dir = isRtl(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try {
      window.localStorage.setItem('ather.locale', locale);
    } catch {
      // ignore
    }
  }, [locale]);

  const tr = useMemo(() => makeT(locale), [locale]);
  const isClient = now.getTime() !== 0;

  // Greeting in the selected locale, with a sensible fallback.
  const greeting = useMemo(() => {
    if (!isClient) return tr('hello');
    const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
    const h = ist.getUTCHours();
    if (h >= 5 && h < 12) return tr('morning');
    if (h >= 12 && h < 17) return tr('afternoon');
    if (h >= 17 && h < 21) return tr('evening');
    return tr('hello');
  }, [now, tr, isClient]);

  const istNow = isClient ? formatIST(now) : '';
  const businessHour = isClient ? isIndiaBusinessHour(now) : true;
  const festival = isClient ? festivalOn(now) : null;

  const sampleEarningsPaise = 12_50_000_00;
  const sampleEarningsRupees = sampleEarningsPaise / 100;

  return (
    <main>
      <div className="tricolour" aria-hidden="true">
        <span className="saffron" />
        <span className="white" />
        <span className="green" />
      </div>

      <section className="topbar">
        <span className="tag">{tr('bharatFirst')}</span>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </section>

      <section className="hero">
        {isClient && (
          <div className="greeting">
            <span className="dot" aria-hidden="true" />
            <span>
              {greeting} · {istGreeting('en', now)} — {istNow}
              {' · '}
              {businessHour ? '🟢 ' : '🌙 '}
              {tr(businessHour ? 'activeHours' : 'quietHours')}
            </span>
          </div>
        )}
        <h1>{tr('heroTitle')}</h1>
        <p className="hi">{tr('heroSub')}</p>
        <p className="lead">{tr('heroLead')}</p>
        <p className="lang-count">
          🌐 {LOCALE_COUNT} {tr('languagesSupported')}
        </p>
      </section>

      {festival && (
        <div className="festival-banner" role="note">
          🎉 <strong>{festival.name}</strong> · {festival.nameHi}
        </div>
      )}

      <section className="demo" aria-label="Live demo">
        <div className="cell">
          <span className="k">{tr('sampleEarnings')}</span>
          <span className="v">{formatINR(sampleEarningsPaise)}</span>
          <span className="k">{toHindiAmountWord(sampleEarningsRupees)} रुपये</span>
        </div>
        <div className="cell">
          <span className="k">{tr('upiPsps')}</span>
          <span className="v">{KNOWN_UPI_PSPS.length}+ PSPs</span>
          <span className="k">@oksbi · @ybl · @paytm · @apl …</span>
        </div>
        <div className="cell">
          <span className="k">{tr('timezone')}</span>
          <span className="v">Asia/Kolkata</span>
          <span className="k">UTC+05:30 · no DST</span>
        </div>
        <div className="cell">
          <span className="k">{tr('compliance')}</span>
          <span className="v">DPDP · GST · RBI</span>
          <span className="k">PII redaction · KYC-ready</span>
        </div>
      </section>

      <h2>{tr('featuresHeading')}</h2>
      <p className="section-sub">{tr('featuresSub')}</p>

      <div className="grid">
        {FEATURES.map((f) => (
          <div className="card" key={f.title}>
            <span className={PILLAR_CLASS[f.pillar]}>
              {PILLAR_LABEL[f.pillar]} · {f.status}
            </span>
            <h3>{f.title}</h3>
            <span className="hi-label">{f.titleHi}</span>
            <p>{f.description}</p>
          </div>
        ))}
      </div>

      <footer>
        <span>{tr('madeIn')} · भारत में निर्मित</span>
        <span>
          <a href="https://github.com/ajay35247/Ather/tree/main/docs">
            {tr('seeArchitecture')}
          </a>
        </span>
      </footer>
    </main>
  );
}

interface LanguagePickerProps {
  locale: LocaleCode;
  onChange: (code: LocaleCode) => void;
}

function LanguagePicker({ locale, onChange }: LanguagePickerProps) {
  const tr = makeT(locale);
  const id = 'ather-locale-picker';
  return (
    <label className="lang-picker" htmlFor={id}>
      <span className="lang-picker__icon" aria-hidden="true">🌐</span>
      <span className="lang-picker__label">{tr('chooseLanguage')}:</span>
      <select
        id={id}
        value={locale}
        onChange={(e) => onChange(e.target.value as LocaleCode)}
        aria-label={tr('chooseLanguage')}
      >
        <optgroup label="भारत · Bharat (Eighth Schedule)">
          {INDIAN_LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} — {l.englishName}
            </option>
          ))}
        </optgroup>
        <optgroup label="World">
          {WORLD_LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} — {l.englishName}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
