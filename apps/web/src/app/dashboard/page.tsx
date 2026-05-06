'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Calendar,
  Eye,
  Heart,
  IndianRupee,
  MessageCircle,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_LOCALE,
  type LocaleCode,
  getLocale,
  isRtl,
  makeT,
  resolveLocale,
} from '@ather/i18n';
import { formatINR, formatIST, festivalOn, istGreeting } from '@ather/india';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';

// ─────────────────────────────────────────────────────────────────────────
// Demo data — wire to /api/dashboard once backend route exists.
// ─────────────────────────────────────────────────────────────────────────

const KPIS = [
  {
    label: 'Earnings (this month)',
    valuePaise: 1_24_750_00,
    delta: '+18.4%',
    trend: 'up' as const,
    icon: IndianRupee,
    accent: 'from-brand-500 to-amber-500',
  },
  {
    label: 'Followers',
    value: '32,481',
    delta: '+1,204',
    trend: 'up' as const,
    icon: Users,
    accent: 'from-chakra-500 to-blue-500',
  },
  {
    label: 'Reach (28d)',
    value: '4.2L',
    delta: '+9.7%',
    trend: 'up' as const,
    icon: Eye,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    label: 'Engagement',
    value: '7.8%',
    delta: '-0.4%',
    trend: 'down' as const,
    icon: Activity,
    accent: 'from-rose-500 to-pink-500',
  },
];

const RECENT_ACTIVITY = [
  { id: 1, kind: 'tip', who: '@neha_singh', amount: 5_00_00, at: '2 min ago' },
  { id: 2, kind: 'follow', who: '@arjun.dev', at: '14 min ago' },
  { id: 3, kind: 'comment', who: '@priya', preview: 'Loved this thread! 🔥', at: '1 hr ago' },
  { id: 4, kind: 'tip', who: '@vikas', amount: 11_00, at: '2 hr ago' },
  { id: 5, kind: 'follow', who: '@rahul_mumbai', at: '3 hr ago' },
  { id: 6, kind: 'mention', who: '@ather_team', preview: 'Featured in #BharatBuilders', at: '5 hr ago' },
];

const TOP_POSTS = [
  { id: 1, title: 'Why UPI changed my creator income forever', views: '48.2K', likes: 3120, comments: 412 },
  { id: 2, title: 'A 60-second tour of Mumbai street food', views: '31.7K', likes: 2087, comments: 178 },
  { id: 3, title: 'Open-sourcing my React Native gestures lib', views: '22.4K', likes: 1410, comments: 256 },
];

const QUICK_ACTIONS = [
  { href: '/feed/create', label: 'New Post', icon: Sparkles, accent: 'from-brand-500 to-amber-500' },
  { href: '/live', label: 'Go Live', icon: Radio, accent: 'from-rose-500 to-red-500' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, accent: 'from-chakra-500 to-blue-500' },
  { href: '/wallet', label: 'Withdraw', icon: Wallet, accent: 'from-emerald-500 to-teal-500' },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function detectInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem('ather.locale');
    if (saved && getLocale(saved)) return getLocale(saved)!.code;
  } catch {
    /* ignore */
  }
  const nav = window.navigator;
  return resolveLocale(nav?.languages?.join(',') || nav?.language);
}

// Tiny inline sparkline so we don't need a charting dep.
function Sparkline({ values, color = '#f97316' }: { values: number[]; color?: string }) {
  const w = 120;
  const h = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [now, setNow] = useState<Date>(() => new Date(0));

  useEffect(() => {
    setLocale(detectInitialLocale());
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const tr = useMemo(() => makeT(locale), [locale]);
  const isClient = now.getTime() !== 0;

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
  const festival = isClient ? festivalOn(now) : null;

  // Deterministic-but-pretty sparkline data for demo purposes.
  const earningsSpark = [12, 18, 14, 22, 28, 24, 32, 30, 36, 41, 38, 47];
  const followersSpark = [120, 140, 132, 168, 175, 190, 210, 225, 240, 252, 268, 290];
  const reachSpark = [8, 12, 11, 14, 13, 18, 22, 19, 24, 27, 25, 31];
  const engagementSpark = [9.2, 9.0, 8.5, 8.8, 8.4, 8.2, 8.0, 7.9, 7.6, 7.7, 7.8, 7.8];
  const SPARKS = [earningsSpark, followersSpark, reachSpark, engagementSpark];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {greeting} <span className="text-brand-500">·</span>{' '}
              <span className="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            {isClient && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4" />
                <span>{istGreeting('en', now)} · {istNow}</span>
                {festival && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500/15 to-emerald-500/15 border border-brand-500/30 text-xs font-medium">
                    🎉 {festival.name}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-brand-500/40 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-gray-900" />
            </button>
            <Link
              href="/feed/create"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-amber-500 hover:from-brand-400 hover:to-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-600/20 hover:shadow-lg"
            >
              <Sparkles className="w-4 h-4" /> New Post
            </Link>
          </div>
        </header>

        {/* KPI grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {KPIS.map((kpi, i) => {
            const Icon = kpi.icon;
            const value = 'valuePaise' in kpi && kpi.valuePaise != null
              ? formatINR(kpi.valuePaise)
              : (kpi as { value: string }).value;
            return (
              <div
                key={kpi.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div
                  aria-hidden
                  className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${kpi.accent} opacity-10 group-hover:opacity-20 transition-opacity blur-2xl`}
                />
                <div className="flex items-center justify-between mb-3 relative">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.accent} flex items-center justify-center text-white shadow-md`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                      kpi.trend === 'up'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {kpi.trend === 'up' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {kpi.delta}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  {kpi.label}
                </p>
                <p className="text-2xl font-extrabold tabular-nums mt-1">{value}</p>
                <div className="mt-3">
                  <Sparkline
                    values={SPARKS[i]}
                    color={kpi.trend === 'up' ? '#10b981' : '#f43f5e'}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* Quick actions */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Quick actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon, accent }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-500/50 hover:shadow-md transition-all"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Two-column: activity + top posts */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Activity */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-500" /> Recent activity
              </h2>
              <Link
                href="/notifications"
                className="text-sm text-brand-500 hover:text-brand-600 font-medium"
              >
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500/20 to-amber-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    {a.kind === 'tip' && <IndianRupee className="w-4 h-4" />}
                    {a.kind === 'follow' && <Users className="w-4 h-4" />}
                    {a.kind === 'comment' && <MessageCircle className="w-4 h-4" />}
                    {a.kind === 'mention' && <Sparkles className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <strong className="font-semibold">{a.who}</strong>{' '}
                      {a.kind === 'tip' && (
                        <>
                          tipped you{' '}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatINR(a.amount!)}
                          </span>
                        </>
                      )}
                      {a.kind === 'follow' && 'started following you'}
                      {a.kind === 'comment' && (
                        <>commented: <span className="text-gray-600 dark:text-gray-400">“{a.preview}”</span></>
                      )}
                      {a.kind === 'mention' && (
                        <>mentioned you: <span className="text-gray-600 dark:text-gray-400">“{a.preview}”</span></>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.at}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Top posts */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand-500" /> Top posts
              </h2>
              <Link
                href="/feed"
                className="text-sm text-brand-500 hover:text-brand-600 font-medium"
              >
                Open feed →
              </Link>
            </div>
            <ol className="space-y-4">
              {TOP_POSTS.map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <span className="text-2xl font-extrabold text-gray-300 dark:text-gray-700 tabular-nums w-6 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm mb-1 line-clamp-2">{p.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {p.views}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {p.likes}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> {p.comments}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bharat-specific footer card */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-brand-500/5 via-amber-500/5 to-emerald-500/5 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold mb-0.5">Same-day UPI payouts available</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Withdraw earnings to any VPA · GST-ready invoices generated automatically.
                </p>
              </div>
            </div>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-5 py-2.5 rounded-xl text-sm font-semibold hover:border-brand-500/50 transition-colors"
            >
              <Wallet className="w-4 h-4" /> Open Wallet
            </Link>
          </div>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
