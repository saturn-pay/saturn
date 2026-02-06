'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ApiKeyDisplay } from '@/components/api-key-display';
import type { SignupResponse } from '@/lib/types';
import { useAuth } from '@/lib/auth';

export default function SignupPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<'form' | 'key'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = await apiFetch<SignupResponse>('/v1/signup', {
        method: 'POST',
        body: { name, email, password },
      });

      setApiKey(data.apiKey);
      setStep('key');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const goToDashboard = async () => {
    // Login with email/password to get JWT token
    try {
      const data = await apiFetch<{ token: string }>('/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      login(data.token);
      window.location.href = '/';
    } catch {
      // Fallback to API key if login fails
      login(apiKey);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-5 h-5 rounded-full bg-black" />
          <span className="font-extrabold text-[15px] tracking-tight">
            Saturn
          </span>
        </div>

        {step === 'form' ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Create your account
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Fund with card or Lightning, start calling APIs.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or team name"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/signin" className="text-black font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Your API key
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Use this key for programmatic API access.
            </p>

            <ApiKeyDisplay apiKey={apiKey} />

            <div className="mt-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              Save this key now — it won&apos;t be shown again.
            </div>

            <div className="mt-6 p-4 border border-border rounded-lg bg-surface">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Quickstart
              </div>
              <pre className="font-mono text-xs leading-relaxed text-gray-700 overflow-x-auto">
{`npm install @saturn-pay/sdk

import { Saturn } from '@saturn-pay/sdk'
const saturn = new Saturn({ apiKey: process.env.SATURN_KEY })
const result = await saturn.reason({ prompt: 'Hello' })`}
              </pre>
            </div>

            <button
              onClick={goToDashboard}
              className="w-full mt-6 bg-black text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
