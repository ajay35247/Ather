'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/password/forgot', { email });
      // In non-production the API returns the token directly so the dev/test
      // flow works without an email transport wired up. In prod the token
      // arrives via email; the UI moves to the reset step in either case.
      if (data?.data?.devResetToken) {
        setToken(data.data.devResetToken);
      }
      toast.success('If an account exists for that email, a reset link was sent.');
      setStep('reset');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not start reset');
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/password/reset', { token, password });
      toast.success('Password updated — you can sign in now.');
      setStep('done');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card p-8 w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-brand-600">Ather</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {step === 'request' && 'Reset your password'}
            {step === 'reset' && 'Choose a new password'}
            {step === 'done' && 'Password updated'}
          </p>
        </div>

        {step === 'request' && (
          <form onSubmit={submitRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send reset link
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Reset token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input"
                placeholder="Paste token from the email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Update password
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Your password has been updated and other devices have been signed out.
            </p>
            <Link href="/login" className="btn-primary inline-block">
              Sign in
            </Link>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Remembered it?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
