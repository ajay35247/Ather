'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  CheckCheck,
  Clapperboard,
  Eye,
  Film,
  Flame,
  Hash,
  Heart,
  IndianRupee,
  Megaphone,
  MessageCircle,
  Mic,
  Play,
  PlusCircle,
  Radio,
  Send,
  Share2,
  Sparkles,
  Tv2,
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
// Demo data — wire to real APIs once routes ship.
// ─────────────────────────────────────────────────────────────────────────

type Kpi = {
  label: string;
  delta: string;
  trend: 'up' | 'down';
  icon: typeof IndianRupee;
  accent: string;
} & ({ valuePaise: number } | { value: string });

const KPIS: Kpi[] = [
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
    label: 'Watch time',
    value: '1.2K hrs',
    delta: '+12.3%',
    trend: 'up' as const,
    icon: Tv2,
    accent: 'from-rose-500 to-pink-500',
  },
];

const STORIES = [
  { id: 'me', name: 'Your story', initial: '+', isYou: true, color: 'from-gray-400 to-gray-600' },
  { id: 1, name: 'neha_singh', initial: 'N', color: 'from-rose-500 to-pink-500' },
  { id: 2, name: 'arjun.dev', initial: 'A', color: 'from-amber-500 to-orange-500' },
  { id: 3, name: 'priya', initial: 'P', color: 'from-emerald-500 to-teal-500' },
  { id: 4, name: 'vikas', initial: 'V', color: 'from-indigo-500 to-purple-500' },
  { id: 5, name: 'rahul_mum', initial: 'R', color: 'from-cyan-500 to-blue-500' },
  { id: 6, name: 'sara_k', initial: 'S', color: 'from-fuchsia-500 to-pink-500' },
  { id: 7, name: 'dev_blog', initial: 'D', color: 'from-yellow-500 to-amber-500' },
  { id: 8, name: 'mumbai_eats', initial: 'M', color: 'from-red-500 to-rose-500' },
  { id: 9, name: 'kerala_co', initial: 'K', color: 'from-green-500 to-emerald-500' },
];

const SHORTS = [
  { id: 1, title: '60-sec Mumbai street food tour 🌶️', author: '@mumbai_eats', views: '124K', likes: '8.2K', tag: 'Food', gradient: 'from-rose-600 via-orange-500 to-amber-400' },
  { id: 2, title: 'How UPI changed creator income 💸', author: '@finance_arjun', views: '88K', likes: '6.1K', tag: 'Finance', gradient: 'from-emerald-600 via-teal-500 to-cyan-400' },
  { id: 3, title: 'React Native gestures in 30s', author: '@arjun.dev', views: '54K', likes: '4.0K', tag: 'Tech', gradient: 'from-indigo-600 via-purple-500 to-fuchsia-400' },
  { id: 4, title: 'Diwali rangoli speedrun ✨', author: '@priya', views: '210K', likes: '14.7K', tag: 'Art', gradient: 'from-brand-600 via-rose-500 to-pink-400' },
  { id: 5, title: 'Bengaluru cafe hop 30s', author: '@sara_k', views: '41K', likes: '3.3K', tag: 'Travel', gradient: 'from-cyan-600 via-blue-500 to-indigo-400' },
  { id: 6, title: 'Hindi standup: Mumbai locals', author: '@vikas', views: '372K', likes: '28.4K', tag: 'Comedy', gradient: 'from-yellow-500 via-amber-500 to-orange-500' },
];

const LIVES = [
  { id: 1, title: 'Live Q&A: building on Ather', host: '@ather_team', viewers: '2.4K', tag: 'Tech' },
  { id: 2, title: 'Cooking biryani right now 🍚', host: '@mumbai_eats', viewers: '1.1K', tag: 'Food' },
  { id: 3, title: 'Trading hour: market wrap', host: '@finance_arjun', viewers: '5.7K', tag: 'Finance' },
];

const CHATS = [
  { id: 1, name: 'Priya Sharma', handle: '@priya', last: 'See you at 7 then 👋', at: '2m', unread: 2, online: true },
  { id: 2, name: 'Bharat Builders', handle: 'group · 142', last: 'Arjun: shipped the ranker v2', at: '14m', unread: 8, online: false },
  { id: 3, name: 'Neha Singh', handle: '@neha_singh', last: 'Tipped you ₹500 — thanks!', at: '1h', unread: 0, online: true, sent: true },
  { id: 4, name: 'Ather Support', handle: '@ather_team', last: 'KYC verified ✅', at: '3h', unread: 0, online: false, sent: true },
  { id: 5, name: 'Mumbai Foodies', handle: 'group · 38', last: 'Vikas: try the vada pav at…', at: '5h', unread: 0, online: false },
];

const SUBSCRIPTIONS = [
  { id: 1, name: 'Bharat Builders', handle: '@bharat.dev', initial: 'B', color: 'from-brand-500 to-amber-500', live: true },
  { id: 2, name: 'Finance Arjun', handle: '@finance_arjun', initial: 'F', color: 'from-emerald-500 to-teal-500', live: false },
  { id: 3, name: 'Mumbai Eats', handle: '@mumbai_eats', initial: 'M', color: 'from-rose-500 to-red-500', live: true },
  { id: 4, name: 'Priya Art', handle: '@priya', initial: 'P', color: 'from-fuchsia-500 to-pink-500', live: false },
  { id: 5, name: 'Code With Sara', handle: '@sara_k', initial: 'S', color: 'from-indigo-500 to-purple-500', live: false },
  { id: 6, name: 'Vikas Comedy', handle: '@vikas', initial: 'V', color: 'from-yellow-500 to-amber-500', live: false },
];

const TRENDING_TAGS = [
  { tag: 'BharatBuilders', posts: '24.1K' },
  { tag: 'UPILife', posts: '18.7K' },
  { tag: 'Diwali2026', posts: '92.4K' },
  { tag: 'StartupIndia', posts: '12.3K' },
  { tag: 'MumbaiRains', posts: '7.9K' },
  { tag: 'HindiTech', posts: '5.6K' },
];

const TOP_CREATORS = [
  { id: 1, name: '@priya', subs: '128K', growth: '+4.2K' },
  { id: 2, name: '@vikas', subs: '94K', growth: '+3.8K' },
  { id: 3, name: '@finance_arjun', subs: '76K', growth: '+2.1K' },
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

const QUICK_CREATE = [
  { href: '/feed/create', label: 'Post', icon: PlusCircle, accent: 'from-brand-500 to-amber-500' },
  { href: '/feed?type=reel', label: 'Reel', icon: Film, accent: 'from-rose-500 to-pink-500' },
  { href: '/live', label: 'Go Live', icon: Radio, accent: 'from-red-500 to-rose-500' },
  { href: '/feed/create?kind=story', label: 'Story', icon: Camera, accent: 'from-fuchsia-500 to-purple-500' },
  { href: '/communities?new=channel', label: 'Channel', icon: Megaphone, accent: 'from-chakra-500 to-blue-500' },
  { href: '/communities?new=group', label: 'Group', icon: Users, accent: 'from-emerald-500 to-teal-500' },
  { href: '/messages?new=true', label: 'Chat', icon: MessageCircle, accent: 'from-cyan-500 to-blue-500' },
  { href: '/live?audio=1', label: 'Audio Room', icon: Mic, accent: 'from-yellow-500 to-amber-500' },
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

// Mini bar chart for "last 7 days" surfaces.
function MiniBars({ values, color = '#f97316' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md transition-all"
          style={{ height: `${(v / max) * 100}%`, background: color, opacity: 0.35 + 0.65 * (v / max) }}
        />
      ))}
    </div>
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
  const watchSpark = [40, 52, 48, 61, 73, 68, 82, 90, 88, 105, 112, 120];
  const SPARKS = [earningsSpark, followersSpark, reachSpark, watchSpark];
  const weeklyViews = [120, 180, 150, 240, 310, 280, 400];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {greeting} <span className="text-brand-500">·</span>{' '}
              <span className="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent">
                Studio
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

        {/* Stories rail (Instagram / Facebook style) */}
        <section className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STORIES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div className={`relative p-[3px] rounded-full ${s.isYou ? 'bg-gray-300 dark:bg-gray-700' : 'bg-gradient-to-tr from-brand-500 via-rose-500 to-amber-500'}`}>
                  <div className="bg-white dark:bg-gray-950 p-[2px] rounded-full">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center text-white font-bold text-xl group-hover:scale-105 transition-transform`}>
                      {s.initial}
                    </div>
                  </div>
                  {s.isYou && (
                    <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-brand-500 border-2 border-white dark:border-gray-950 flex items-center justify-center text-white">
                      <PlusCircle className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[72px] truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Quick create launcher */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Create
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3">
            {QUICK_CREATE.map(({ href, label, icon: Icon, accent }) => (
              <Link
                key={label}
                href={href}
                className="group flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand-500/50 hover:shadow-md transition-all"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-xs text-center">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* KPI grid (YouTube Studio analytics) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {KPIS.map((kpi, i) => {
            const Icon = kpi.icon;
            const value = 'valuePaise' in kpi ? formatINR(kpi.valuePaise) : kpi.value;
            return (
              <div
                key={kpi.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div
                  aria-hidden
                  className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${kpi.accent} opacity-10 group-hover:opacity-20 transition-opacity blur-2xl`}
                />
                <div className="flex items-center justify-between mb-3 relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.accent} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
                      kpi.trend === 'up'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {kpi.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {kpi.delta}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  {kpi.label}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums mt-1">{value}</p>
                <div className="mt-3">
                  <Sparkline values={SPARKS[i]} color={kpi.trend === 'up' ? '#10b981' : '#f43f5e'} />
                </div>
              </div>
            );
          })}
        </section>

        {/* Shorts / Reels rail (TikTok / YT Shorts) */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clapperboard className="w-5 h-5 text-rose-500" /> Shorts &amp; Reels
            </h2>
            <Link href="/feed?type=reel" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
              See all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SHORTS.map((s) => (
              <Link
                key={s.id}
                href={`/feed?type=reel&id=${s.id}`}
                className="group relative flex-shrink-0 w-40 sm:w-44 aspect-[9/16] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur text-white text-[10px] font-semibold uppercase tracking-wider">
                  <Hash className="w-3 h-3" />{s.tag}
                </span>
                <span className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-4 h-4 fill-white" />
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <p className="text-xs font-semibold line-clamp-2 mb-1">{s.title}</p>
                  <p className="text-[10px] text-white/80 mb-1.5">{s.author}</p>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{s.views}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{s.likes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Live now */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              Live now
            </h2>
            <Link href="/live" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
              All streams →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIVES.map((l) => (
              <Link
                key={l.id}
                href={`/live?stream=${l.id}`}
                className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-red-500/40 hover:shadow-lg transition-all"
              >
                <div className="relative aspect-video bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                  <Radio className="w-10 h-10 text-white/30 group-hover:text-white/50 transition-colors" />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                  </span>
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
                    <Eye className="w-3 h-3" />{l.viewers}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm line-clamp-1">{l.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l.host} · #{l.tag}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Three-column: subscriptions / chats / trending */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Subscriptions (YouTube) */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2">
                <Tv2 className="w-5 h-5 text-brand-500" /> Subscriptions
              </h2>
              <Link href="/communities" className="text-sm text-brand-500 hover:text-brand-600 font-medium">All →</Link>
            </div>
            <ul className="space-y-3">
              {SUBSCRIPTIONS.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/profile?u=${c.handle.replace('@','')}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white font-bold`}>
                        {c.initial}
                      </div>
                      {c.live && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold uppercase tracking-wider ring-2 ring-white dark:ring-gray-900">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.handle}</p>
                    </div>
                    <Bell className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Telegram-style chats */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2">
                <Send className="w-5 h-5 text-chakra-500" /> Chats
              </h2>
              <Link href="/messages" className="text-sm text-brand-500 hover:text-brand-600 font-medium">Open →</Link>
            </div>
            <ul className="space-y-1">
              {CHATS.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/messages?to=${c.handle.replace('@','')}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chakra-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {c.name.charAt(0)}
                      </div>
                      {c.online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <span className="text-[10px] text-gray-500 flex-shrink-0">{c.at}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          {c.sent && <CheckCheck className="w-3 h-3 text-chakra-500 flex-shrink-0" />}
                          {c.last}
                        </p>
                        {c.unread > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trending + Top creators */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-500" /> Trending
                </h2>
                <Link href="/search?tab=trending" className="text-sm text-brand-500 hover:text-brand-600 font-medium">More →</Link>
              </div>
              <ul className="space-y-2">
                {TRENDING_TAGS.map((t, i) => (
                  <li key={t.tag}>
                    <Link
                      href={`/search?q=%23${t.tag}`}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">{i + 1}</span>
                      <Hash className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{t.tag}</p>
                        <p className="text-[11px] text-gray-500">{t.posts} posts</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h2 className="font-bold flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" /> Top creators
              </h2>
              <ul className="space-y-3">
                {TOP_CREATORS.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="text-lg font-extrabold text-gray-300 dark:text-gray-700 w-5 tabular-nums">{i + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.name.charAt(1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500">{c.subs} subs · <span className="text-emerald-500 font-semibold">{c.growth}</span></p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Activity + Top posts + Weekly views */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-500" /> Recent activity
              </h2>
              <Link href="/notifications" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
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

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-500" /> Views · 7d
                </h2>
                <span className="text-xs text-emerald-500 font-semibold">+24%</span>
              </div>
              <MiniBars values={weeklyViews} color="#10b981" />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-500" /> Top posts
                </h2>
                <Link href="/feed" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
                  Open feed →
                </Link>
              </div>
              <ol className="space-y-4">
                {TOP_POSTS.map((p, i) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="text-2xl font-extrabold text-gray-300 dark:text-gray-700 tabular-nums w-6 flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm mb-1 line-clamp-2">{p.title}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{p.views}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{p.likes}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{p.comments}</span>
                        <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" /></span>
                        <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3" /></span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
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
