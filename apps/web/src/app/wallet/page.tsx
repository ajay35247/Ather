'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Plus, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Wallet {
  balance: number;
  currency: string;
  totalEarned: number;
  totalSpent: number;
}

interface Transaction {
  id: string;
  type: 'tip' | 'subscription' | 'topup' | 'payout' | 'ad_revenue';
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
}

interface Earnings {
  wallet: Wallet;
  tipsCount: number;
  tipsTotal: number;
  activeSubscribers: number;
  monthlyRecurring: number;
  currency: string;
}

function fmt(amount: number, currency: string) {
  // amount is in minor units
  const major = amount / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [topping, setTopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [w, e, t] = await Promise.all([
      api.get('/api/monetization/wallet'),
      api.get('/api/monetization/earnings'),
      api.get('/api/monetization/transactions'),
    ]);
    setWallet(w.data.data);
    setEarnings(e.data.data);
    setTxs(t.data.data || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  async function topup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive amount');
      return;
    }
    setTopping(true);
    try {
      // Convert major → minor units (cents).
      await api.post('/api/monetization/wallet/topup', { amount: Math.round(amount * 100) });
      setTopupAmount('');
      await refresh();
    } catch {
      setError('Top-up failed');
    } finally {
      setTopping(false);
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
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 pb-20 md:pb-6">
        <header className="flex items-center gap-2 mb-6">
          <WalletIcon className="w-6 h-6 text-brand-500" />
          <h1 className="text-2xl font-bold">Wallet & Earnings</h1>
        </header>

        {/* Balance card */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 text-white p-6 mb-6 shadow-lg">
          <p className="text-sm opacity-80">Available balance</p>
          <p className="text-4xl font-extrabold mt-1">
            {wallet ? fmt(wallet.balance, wallet.currency) : '—'}
          </p>
          <div className="flex gap-4 mt-4 text-sm">
            <div>
              <p className="opacity-70">Earned</p>
              <p className="font-semibold">
                {wallet ? fmt(wallet.totalEarned, wallet.currency) : '—'}
              </p>
            </div>
            <div>
              <p className="opacity-70">Spent</p>
              <p className="font-semibold">
                {wallet ? fmt(wallet.totalSpent, wallet.currency) : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Top up */}
        <section className="card p-4 mb-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold mb-3">Top up</h2>
          <form onSubmit={topup} className="flex gap-2 items-start">
            <input
              type="number"
              min="1"
              step="0.01"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="Amount"
              className="input flex-1"
              disabled={topping}
            />
            <button
              type="submit"
              disabled={topping}
              className="btn-primary px-4 flex items-center gap-2"
            >
              {topping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add funds
            </button>
          </form>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Demo only — no real money is moved. Integrate Stripe/Razorpay in production.
          </p>
        </section>

        {/* Creator earnings */}
        {earnings && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Tips received" value={String(earnings.tipsCount)} />
            <Stat
              label="Tip total"
              value={fmt(earnings.tipsTotal, earnings.currency)}
            />
            <Stat label="Subscribers" value={String(earnings.activeSubscribers)} />
            <Stat
              label="Monthly recurring"
              value={fmt(earnings.monthlyRecurring, earnings.currency)}
            />
          </section>
        )}

        {/* Transactions */}
        <section className="card bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold p-4 border-b border-gray-200 dark:border-gray-800">
            Recent activity
          </h2>
          {txs.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">No transactions yet.</p>
          ) : (
            <ul>
              {txs.map((t) => {
                const incoming = !!t.toUserId && t.type !== 'topup';
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        incoming
                          ? 'bg-green-100 text-green-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {incoming ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm capitalize">{t.type.replace('_', ' ')}</p>
                      {t.note && (
                        <p className="text-xs text-gray-500 truncate">{t.note}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        incoming ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      {incoming ? '+' : '−'}
                      {fmt(t.amount, t.currency)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      <MobileNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-lg mt-1">{value}</p>
    </div>
  );
}
