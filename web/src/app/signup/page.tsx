'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { SignupResponse } from '@/lib/types';
import { useAuth } from '@/lib/auth';

export default function SignupPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<'form' | 'key'>('form');
  const [userName, setUserName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = await apiFetch<SignupResponse>('/v1/signup', {
        method: 'POST',
        body: { name: agentName, userName, email, password },
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

  const isValid = userName && agentName && email && password && password.length >= 8;

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
              Create your first agent
            </h1>
            <p className="text-muted mb-8">
              Set up your account and get an API key in seconds
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="John Doe"
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
                  Agent name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="my-research-agent"
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
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
                {submitting ? 'Creating agent...' : 'Create agent'}
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
              Your first agent is ready
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
              <pre className="font-mono text-xs overflow-x-auto leading-relaxed">
                <span className="text-zinc-500">npm i</span> <span className="text-green-400">@saturn-pay/sdk</span>{'\n\n'}
                <span className="text-pink-400">const</span> <span className="text-zinc-300">saturn</span> <span className="text-pink-400">=</span> <span className="text-pink-400">new</span> <span className="text-purple-400">Saturn</span>{'({'}{'\n'}
                {'  '}<span className="text-blue-400">apiKey</span>: <span className="text-green-400">&apos;{apiKey.slice(0, 18)}...&apos;</span>{'\n'}
                {'})'}
                {'\n'}<span className="text-pink-400">await</span> <span className="text-zinc-300">saturn</span>.<span className="text-purple-400">reason</span>{'({ '}<span className="text-blue-400">prompt</span>: <span className="text-green-400">&apos;Hi&apos;</span>{' })'}
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
