'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
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
  const [copied, setCopied] = useState(false);

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

  const copyKey = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToDashboard = async () => {
    try {
      const data = await apiFetch<{ token: string }>('/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      login(data.token);
      window.location.href = '/';
    } catch {
      login(apiKey);
      window.location.href = '/';
    }
  };

  const isValid = name && email && password && password.length >= 8;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-background" />
          </div>
          <span className="text-xl font-bold tracking-tight">Saturn</span>
        </div>

        {step === 'form' ? (
          <>
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Create account
            </h1>
            <p className="text-muted mb-8">
              Start building with pay-per-use AI APIs
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or team"
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !isValid}
                className="btn-primary w-full py-3 rounded-lg text-sm"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link href="/signin" className="text-accent hover:text-green-400 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            {/* Success Header */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2">
              You&apos;re all set
            </h1>
            <p className="text-muted mb-8">
              Save your API key — you won&apos;t see it again
            </p>

            {/* API Key Display */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <code className="font-mono text-sm text-zinc-300 truncate flex-1">
                  {apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="btn-secondary px-3 py-1.5 rounded text-xs shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Quickstart */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                Quick start
              </div>
              <pre className="font-mono text-xs text-zinc-400 overflow-x-auto">
{`npm i @saturn-pay/sdk

const saturn = new Saturn({
  apiKey: '${apiKey.slice(0, 20)}...'
})
await saturn.reason({ prompt: 'Hi' })`}
              </pre>
            </div>

            <button
              onClick={goToDashboard}
              className="btn-primary w-full py-3 rounded-lg text-sm"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
