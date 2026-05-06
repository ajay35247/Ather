'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { ShieldCheck, Globe, Heart, Loader2 } from 'lucide-react';

interface IdentityRec {
  activePersona: 'personal' | 'professional' | 'anonymous';
  did?: string;
  didMethod?: string;
  didLinkedAt?: string;
  reputationScore: number;
}

interface WellbeingRec {
  dailyLimitMinutes: number;
  focusMode: boolean;
  todayMinutes: number;
  legacyContactIds: string[];
  legacyInactivityDays: number;
}

const PERSONAS: IdentityRec['activePersona'][] = ['personal', 'professional', 'anonymous'];

export default function SettingsPage() {
  const [identity, setIdentity] = useState<IdentityRec | null>(null);
  const [wellbeing, setWellbeing] = useState<WellbeingRec | null>(null);
  const [didInput, setDidInput] = useState('');
  const [didError, setDidError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLimit, setSavingLimit] = useState(false);

  async function refresh() {
    const [i, w] = await Promise.all([
      api.get('/api/identity'),
      api.get('/api/wellbeing'),
    ]);
    setIdentity(i.data.data);
    setWellbeing(w.data.data);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  async function setPersona(p: IdentityRec['activePersona']) {
    const r = await api.post('/api/identity/persona', { persona: p });
    setIdentity(r.data.data);
  }

  async function linkDid(e: React.FormEvent) {
    e.preventDefault();
    setDidError(null);
    try {
      const r = await api.post('/api/identity/did', { did: didInput.trim() });
      setIdentity(r.data.data);
      setDidInput('');
    } catch (err: any) {
      setDidError(err?.response?.data?.error || 'Failed to link DID');
    }
  }

  async function unlinkDid() {
    const r = await api.delete('/api/identity/did');
    setIdentity(r.data.data);
  }

  async function toggleFocus() {
    if (!wellbeing) return;
    const r = await api.put('/api/wellbeing/focus', { enabled: !wellbeing.focusMode });
    setWellbeing(r.data.data);
  }

  async function updateLimit(minutes: number) {
    setSavingLimit(true);
    try {
      const r = await api.put('/api/wellbeing/limit', { minutes });
      setWellbeing(r.data.data);
    } finally {
      setSavingLimit(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 pb-20 md:pb-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {/* Identity */}
        <section className="card bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold">Identity & Reputation</h2>
          </div>
          <div className="text-sm text-gray-500 mb-3">
            Reputation score: <span className="font-bold text-gray-900 dark:text-gray-100">{identity?.reputationScore}/100</span>
          </div>

          <p className="text-sm font-medium mb-2">Active persona</p>
          <div className="flex gap-2 flex-wrap">
            {PERSONAS.map((p) => (
              <button
                key={p}
                onClick={() => setPersona(p)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  identity?.activePersona === p
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Web3 / DID */}
        <section className="card bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold">Decentralized Identity (Web3)</h2>
          </div>
          {identity?.did ? (
            <div>
              <p className="text-sm font-mono break-all bg-gray-100 dark:bg-gray-800 rounded p-2">
                {identity.did}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Method: <strong>{identity.didMethod}</strong>
                {identity.didLinkedAt && ` · linked ${new Date(identity.didLinkedAt).toLocaleDateString()}`}
              </p>
              <button
                onClick={unlinkDid}
                className="mt-3 text-sm text-red-500 hover:underline"
              >
                Unlink
              </button>
            </div>
          ) : (
            <form onSubmit={linkDid} className="flex gap-2">
              <input
                type="text"
                value={didInput}
                onChange={(e) => setDidInput(e.target.value)}
                placeholder="did:key:z6Mk… or did:ethr:0x…"
                className="input flex-1 font-mono text-xs"
                maxLength={256}
              />
              <button type="submit" className="btn-primary">
                Link
              </button>
            </form>
          )}
          {didError && <p className="text-sm text-red-500 mt-2">{didError}</p>}
          <p className="text-xs text-gray-500 mt-2">
            We never store private keys. Ownership is verified off-chain via a signed challenge.
          </p>
        </section>

        {/* Wellbeing */}
        <section className="card bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold">Digital Wellbeing</h2>
          </div>

          <label className="flex items-center justify-between py-2">
            <span className="text-sm">Focus mode (suppress non-essential notifications)</span>
            <input
              type="checkbox"
              checked={wellbeing?.focusMode || false}
              onChange={toggleFocus}
              className="w-5 h-5 accent-brand-500"
              aria-label="Toggle focus mode"
            />
          </label>

          <div className="py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                Daily limit:{' '}
                <strong>
                  {wellbeing?.dailyLimitMinutes
                    ? `${wellbeing.dailyLimitMinutes} min`
                    : 'No limit'}
                </strong>
              </span>
              <span className="text-xs text-gray-500">
                Today: {wellbeing?.todayMinutes ?? 0} min
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={240}
              step={15}
              value={wellbeing?.dailyLimitMinutes ?? 0}
              disabled={savingLimit}
              onChange={(e) => updateLimit(Number(e.target.value))}
              className="w-full mt-2 accent-brand-500"
              aria-label="Daily usage limit in minutes"
            />
          </div>
        </section>
      </main>
      <MobileNav />
    </div>
  );
}
