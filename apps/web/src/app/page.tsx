import Link from 'next/link';
import {
  MessageCircle,
  Video,
  Users,
  Zap,
  Shield,
  TrendingUp,
  Globe,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: <MessageCircle className="w-6 h-6" />,
    title: 'Unified Messaging',
    desc: 'Chat, voice, video, and live — all in one thread. End-to-end encrypted.',
  },
  {
    icon: <Video className="w-6 h-6" />,
    title: 'Immersive Content',
    desc: 'Short reels, long videos, stories, live streams, and audio rooms.',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Communities',
    desc: 'Reddit-style threads, Discord-style servers, with AI moderation.',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Creator Economy',
    desc: 'Monetize with ads, subscriptions, tips, and paid communities.',
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: 'AI-Powered Feed',
    desc: 'Personalized recommendations with algorithm transparency.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Privacy First',
    desc: 'Full data ownership, granular controls, and zero-trust security.',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Works Everywhere',
    desc: 'Optimized for low bandwidth. Offline-first. Available on all devices.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Blazing Fast',
    desc: 'Under 100 ms interactions. One-thumb mobile-first UX.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-brand-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-2xl font-bold tracking-tight">
          <span className="text-brand-400">Ather</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-gray-300 hover:text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-brand-600/20 border border-brand-500/30 text-brand-300 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          The next social platform is here
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          One platform for{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
            everything social
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Chat, create, stream, discover, and earn — all inside Ather. The unified social
          ecosystem powered by AI that replaces 10 apps with one.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-colors"
          >
            Join for free
          </Link>
          <Link
            href="/feed"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-2xl text-lg font-semibold transition-colors"
          >
            Explore feed
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-white">
          Everything you need, nothing you don&apos;t
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-colors"
            >
              <div className="text-brand-400 mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-4">Ready to join the future of social?</h2>
        <p className="text-gray-400 mb-8">
          Join millions of creators, professionals, and communities on Ather.
        </p>
        <Link
          href="/register"
          className="inline-block bg-brand-600 hover:bg-brand-500 text-white px-10 py-4 rounded-2xl text-lg font-semibold transition-colors"
        >
          Create your account
        </Link>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Ather. Built for the next billion users.</p>
      </footer>
    </div>
  );
}
