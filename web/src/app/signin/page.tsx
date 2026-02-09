'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface LoginResponse {
  token: string;
  accountId: string;
  agentId: string;
  name: string;
  email: string;
}

export default function SigninPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = await apiFetch<LoginResponse>('/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      login(data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = email && password;

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

        {/* Header */}
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="text-muted mb-8">
          Sign in to your account to continue
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="••••••••"
              required
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
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent hover:text-green-400 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
