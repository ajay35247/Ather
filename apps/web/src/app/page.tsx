'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  IndianRupee,
  MessageCircle,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_LOCALE,
  INDIAN_LOCALES,
  WORLD_LOCALES,
  LOCALE_COUNT,
  type LocaleCode,
  getLocale,
  isRtl,
  makeT,
  resolveLocale,
} from '@ather/i18n';
import {
  formatINR,
  formatIST,
  istGreeting,
  festivalOn,
  isIndiaBusinessHour,
  KNOWN_UPI_PSPS,
} from '@ather/india';
import { AuroraBackground } from '@/components/marketing/AuroraBackground';
import { HeroOrb } from '@/components/marketing/HeroOrb';
import { SignalsMarquee } from '@/components/marketing/SignalsMarquee';
import { useSpotlight } from '@/components/marketing/useSpotlight';

// ─────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────

type Pillar = 'creator' | 'safety' | 'ai' | 'bharat' | 'platform';

interface Feature {
  title: string;
  titleHi: string;
  description: string;
  status: 'shipping' | 'in-progress' | 'planned';
  pillar: Pillar;
  icon: React.ElementType;
}

const FEATURES: Feature[] = [
  {
    title: 'UPI Tipping',
    titleHi: 'यूपीआई से टिप दीजिए',
    status: 'in-progress',
    pillar: 'creator',
    icon: IndianRupee,
    description: 'Tip any creator instantly via UPI VPA. Settles in seconds, no card needed.',
  },
  {
    title: 'Bharat Creator Studio',
    titleHi: 'भारत क्रिएटर स्टूडियो',
    status: 'in-progress',
    pillar: 'creator',
    icon: TrendingUp,
    description:
      'Earnings in ₹ with lakh/crore, GST-ready invoices, TDS summaries, same-day payouts.',
  },
  {
    title: 'Regional-Language Feed',
    titleHi: 'क्षेत्रीय भाषा फ़ीड',
    status: 'planned',
    pillar: 'bharat',
    icon: Globe2,
    description:
      'First-class feeds in हिन्दी, தமிழ், తెలుగు, বাংলা, मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ.',
  },
  {
    title: 'DPDP Teen Mode',
    titleHi: 'किशोर सुरक्षा मोड',
    status: 'planned',
    pillar: 'safety',
    icon: ShieldCheck,
    description: 'Default-private under-18 accounts, restricted DMs, screen-time caps.',
  },
  {
    title: 'IST-Aware Notifications',
    titleHi: 'समय-संवेदी सूचनाएँ',
    status: 'shipping',
    pillar: 'ai',
    icon: Sparkles,
    description: 'Notifications honour Indian sleep hours; non-urgent posts batch overnight.',
  },
  {
    title: 'Festival Themes',
    titleHi: 'त्यौहार थीम',
    status: 'shipping',
    pillar: 'bharat',
    icon: Sparkles,
    description: 'Auto-themed app for Diwali, Holi, Eid, Onam, Pongal, Republic & Independence Days.',
  },
  {
    title: 'Aadhaar / PAN Redaction',
    titleHi: 'आधार-पैन ऑटो-छिपाव',
    status: 'shipping',
    pillar: 'safety',
    icon: Shield,
    description: 'Posts and DMs are scanned client-side; obvious Aadhaar / PAN numbers are masked.',
  },
  {
    title: 'GST-Ready Marketplace',
    titleHi: 'जीएसटी-रेडी बाज़ार',
    status: 'planned',
    pillar: 'creator',
    icon: Wallet,
    description: 'CGST + SGST or IGST computed automatically; HSN codes, e-invoice JSON.',
  },
  {
    title: 'Communities with Treasury',
    titleHi: 'समुदाय कोष',
    status: 'planned',
    pillar: 'creator',
    icon: Users,
    description: 'Communities collect tips into a shared ₹ treasury and split via on-ledger rules.',
  },
  {
    title: 'E2EE Direct Messages',
    titleHi: 'एंड-टू-एंड एन्क्रिप्टेड DM',
    status: 'in-progress',
    pillar: 'safety',
    icon: MessageCircle,
    description: 'Server stores ciphertext only. Sealed-sender metadata, disappearing messages.',
  },
  {
    title: 'Live Cricket & Election Surfaces',
    titleHi: 'क्रिकेट और चुनाव',
    status: 'planned',
    pillar: 'bharat',
    icon: Radio,
    description: 'Live cricket score overlays, ball-by-ball reactions, verified-source labels.',
  },
  {
    title: 'Lite Mode (under 5 MB)',
    titleHi: 'लाइट मोड',
    status: 'planned',
    pillar: 'platform',
    icon: Zap,
    description: 'A stripped-down app that runs on 2G/3G and ₹5,000 phones.',
  },
];

const PILLAR_COLORS: Record<Pillar, string> = {
  creator: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  safety: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ai: 'bg-chakra-500/10 text-chakra-300 border-chakra-500/20',
  bharat: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  platform: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

const PILLAR_LABEL: Record<Pillar, string> = {
  creator: 'Creator',
  safety: 'Safety',
  ai: 'AI',
  bharat: 'Bharat',
  platform: 'Platform',
};

const STATUS_LABEL: Record<Feature['status'], string> = {
  shipping: '● shipping',
  'in-progress': '◐ in progress',
  planned: '○ planned',
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function detectInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem('ather.locale');
    if (saved && getLocale(saved)) return getLocale(saved)!.code;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  const nav = window.navigator;
  return resolveLocale(nav?.languages?.join(',') || nav?.language);
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [now, setNow] = useState<Date>(() => new Date(0));

  // Initial locale + clock are client-only to avoid hydration mismatch.
  useEffect(() => {
    setLocale(detectInitialLocale());
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Persist locale and apply dir/lang to <html>.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem('ather.locale', locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const tr = useMemo(() => makeT(locale), [locale]);
  const isClient = now.getTime() !== 0;
  const onSpotlight = useSpotlight();

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

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden relative">
      {/* Cinematic ambient backdrop — replaces the legacy blob trio.
          Aurora sweep + dot grid + vignette, all GPU-only, motion-safe. */}
      <AuroraBackground />

      {/* Tricolour bar */}
      <div className="flex h-1 w-full" aria-hidden>
        <span className="flex-1 bg-india-saffron" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-india-green" />
      </div>

      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Sparkles className="w-6 h-6 text-brand-400 group-hover:rotate-12 transition-transform" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-brand-400 to-amber-300 bg-clip-text text-transparent">
              Ather
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguagePicker locale={locale} onChange={setLocale} />
          <Link
            href="/login"
            className="hidden sm:inline-flex text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-400 hover:to-amber-400 text-white px-4 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40"
          >
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero — text on the left, layered orb on the right (lg+). */}
      <section className="relative max-w-7xl mx-auto px-6 pt-12 pb-12 sm:pt-16 sm:pb-20 animate-fade-in">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            {isClient && (
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full glass text-xs sm:text-sm text-gray-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>
                  {greeting} · {istGreeting('en', now)} — {istNow} · {businessHour ? '🟢 active' : '🌙 quiet'} hours
                </span>
              </div>
            )}

            <h1 className="text-display mb-6">
              आपका सोशल OS,{' '}
              <span className="text-aurora">built for Bharat.</span>
            </h1>

            <p className="text-lead text-gray-300 max-w-2xl lg:max-w-xl mx-auto lg:mx-0 mb-4">
              One identity for posts, chats, communities, payments and creator earnings.
              UPI-native, multilingual, DPDP-compliant.
            </p>
            <p className="text-sm text-gray-400 mb-10 inline-flex items-center gap-2">
              <Globe2 className="w-4 h-4" /> {LOCALE_COUNT} languages supported · 22 Indian + 9 world
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-400 hover:to-amber-400 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all duration-300 ease-soft shadow-glow-warm hover:-translate-y-0.5"
              >
                Join Ather Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform ease-spring duration-300" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 glass hover:glass-strong text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all duration-300 ease-soft"
              >
                <TrendingUp className="w-4 h-4" /> See Dashboard
              </Link>
            </div>

            {festival && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500/20 to-emerald-500/20 border border-brand-500/30 text-sm">
                🎉 <strong>{festival.name}</strong> · {festival.nameHi}
              </div>
            )}
          </div>

          {/* Spatial orb — hidden on small screens to keep the fold tight. */}
          <div className="hidden lg:flex items-center justify-center">
            <HeroOrb />
          </div>
        </div>
      </section>

      {/* Live signals — gives the surface a heartbeat. */}
      <SignalsMarquee
        items={[
          'Creators paid · ' + formatINR(sampleEarningsPaise) + ' this week',
          KNOWN_UPI_PSPS.length + '+ UPI handles supported',
          LOCALE_COUNT + ' languages live',
          'Asia/Kolkata · UTC+05:30 · no DST',
          'DPDP · GST · RBI compliant by default',
          'C2PA content provenance enabled',
        ]}
      />

      {/* Live demo strip — uses @ather/india utilities */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Sample creator earnings" value={formatINR(sampleEarningsPaise)} hint="lakh/crore aware" />
          <StatCard label="UPI PSPs" value={`${KNOWN_UPI_PSPS.length}+`} hint="@oksbi · @ybl · @paytm …" />
          <StatCard label="Timezone" value="Asia/Kolkata" hint="UTC+05:30 · no DST" />
          <StatCard label="Compliance" value="DPDP · GST · RBI" hint="PII redaction built-in" />
        </div>
      </section>

      {/* Pillar pills */}
      <section className="max-w-7xl mx-auto px-6 pb-8 flex flex-wrap justify-center gap-2">
        {(['creator', 'safety', 'ai', 'bharat', 'platform'] as Pillar[]).map((p) => (
          <span
            key={p}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${PILLAR_COLORS[p]}`}
          >
            {PILLAR_LABEL[p]}
          </span>
        ))}
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Everything social, in one place.
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Replace ten apps with one. Built mobile-first, India-first.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <article
                key={f.title}
                onMouseMove={onSpotlight}
                className="spotlight ring-chromatic group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-2xl p-6 transition-all duration-500 ease-soft hover:-translate-y-1 hover:shadow-lift backdrop-blur"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Top tricolour accent on hover */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-india-saffron via-white/40 to-india-green opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl"
                />

                <div className="relative z-[2] flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/20 to-amber-500/20 border border-brand-500/20 flex items-center justify-center text-brand-300 group-hover:scale-110 transition-transform duration-300 ease-spring">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full border ${PILLAR_COLORS[f.pillar]}`}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                </div>

                <h3 className="relative z-[2] text-lg font-bold text-white mb-1">{f.title}</h3>
                <p className="relative z-[2] text-sm text-gray-400 mb-3">{f.titleHi}</p>
                <p className="relative z-[2] text-sm text-gray-300 leading-relaxed">{f.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="ring-chromatic glass-strong rounded-2xl p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: ShieldCheck, label: 'DPDP-compliant by default' },
              { icon: IndianRupee, label: 'UPI-native · GST-ready' },
              { icon: CheckCircle2, label: 'C2PA content provenance' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <Icon className="w-6 h-6 text-brand-400" />
                <p className="text-sm text-gray-300 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — chromatic ring + drifting starfield. */}
      <section className="relative max-w-3xl mx-auto px-6 py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(rgb(255 255 255 / 0.6) 1px, transparent 1px), radial-gradient(rgb(255 255 255 / 0.4) 1px, transparent 1px)',
            backgroundSize: '120px 120px, 200px 200px',
            backgroundPosition: '0 0, 60px 60px',
            maskImage:
              'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 80%)',
          }}
        />
        <h2 className="text-display !text-4xl sm:!text-5xl mb-4">
          Join the <span className="text-aurora">next billion</span> on Ather.
        </h2>
        <p className="text-gray-400 mb-8">
          Free forever for personal use. Creator monetisation in days, not months.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-400 hover:to-amber-400 text-white px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-300 ease-soft shadow-glow-warm hover:-translate-y-0.5"
        >
          Create your account <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Ather · Made in India · भारत में निर्मित</p>
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/feed" className="hover:text-white transition-colors">Feed</Link>
            <a
              href="https://github.com/ajay35247/Ather/tree/main/docs"
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Architecture
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  const onSpotlight = useSpotlight();
  return (
    <div
      onMouseMove={onSpotlight}
      className="ring-chromatic spotlight rounded-2xl glass p-5 transition-colors duration-300 ease-soft hover:bg-white/[0.06]"
    >
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
        {label}
      </p>
      <p className="text-xl font-bold text-white tabular-nums mb-1">{value}</p>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );
}

interface LanguagePickerProps {
  locale: LocaleCode;
  onChange: (code: LocaleCode) => void;
}

function LanguagePicker({ locale, onChange }: LanguagePickerProps) {
  const tr = makeT(locale);
  return (
    <label
      htmlFor="ather-locale-picker"
      className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
    >
      <Globe2 className="w-3.5 h-3.5" aria-hidden />
      <select
        id="ather-locale-picker"
        value={locale}
        onChange={(e) => onChange(e.target.value as LocaleCode)}
        aria-label={tr('chooseLanguage')}
        className="bg-transparent outline-none cursor-pointer max-w-[10rem] text-white"
      >
        <optgroup label="भारत · Bharat (Eighth Schedule)" className="bg-gray-900">
          {INDIAN_LOCALES.map((l) => (
            <option key={l.code} value={l.code} className="bg-gray-900">
              {l.nativeName} — {l.englishName}
            </option>
          ))}
        </optgroup>
        <optgroup label="World" className="bg-gray-900">
          {WORLD_LOCALES.map((l) => (
            <option key={l.code} value={l.code} className="bg-gray-900">
              {l.nativeName} — {l.englishName}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
