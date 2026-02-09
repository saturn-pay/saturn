'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatUsdCents, formatDateTime } from '@/lib/format';
import type { AdminStats, AdminTransaction, AdminAgent, Paginated, Wallet } from '@/lib/types';

export default function DashboardHome() {
  const { apiKey } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTx, setRecentTx] = useState<AdminTransaction[]>([]);
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Map agentId to agent name
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [agents]);

  // Check if user is new (no transactions yet)
  const isNewUser = recentTx.length === 0 && !loading;
  const hasBalance = (wallet?.balanceUsdCents ?? 0) > 0 || (wallet?.balanceSats ?? 0) > 0;
  const hasApiCalls = (stats?.totalTransactions ?? 0) > 0;

  useEffect(() => {
    if (!apiKey) return;

    Promise.all([
      apiFetch<Wallet>('/v1/wallet', { apiKey }),
      apiFetch<AdminStats>('/v1/admin/stats', { apiKey }),
      apiFetch<Paginated<AdminTransaction>>('/v1/admin/transactions', {
        apiKey,
        params: { limit: 5 },
      }),
      apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey }),
    ])
      .then(([w, s, tx, ag]) => {
        setWallet(w);
        setStats(s);
        setRecentTx(tx.data);
        setAgents(ag);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  return (
    <div>
      {/* Balance Card */}
      <div className="border border-border rounded-xl p-6 mb-6 bg-surface">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted mb-1">Available Balance</div>
            <div className="text-4xl font-bold text-accent font-mono tracking-tight">
              {formatUsdCents(wallet?.balanceUsdCents ?? 0)}
            </div>
            <div className="text-sm text-muted font-mono mt-1">
              {formatSats(wallet?.balanceSats ?? 0)} sats
            </div>
          </div>
          <a
            href="/wallet"
            className="btn-primary px-5 py-2.5 rounded-lg text-sm"
          >
            Add funds
          </a>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Today&apos;s Spend</div>
          <div className="text-2xl font-bold font-mono">
            {formatUsdCents(stats?.usdCentsOut ?? 0)}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Total API Calls</div>
          <div className="text-2xl font-bold font-mono">
            {formatSats(stats?.totalTransactions ?? 0)}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Active Agents</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold font-mono text-blue-400">
              {agents.length}
            </div>
            <a href="/keys" className="btn-primary px-4 py-2 rounded-lg text-sm">
              Create agent
            </a>
          </div>
        </div>
      </div>

      {/* Getting Started Checklist - only show for new users */}
      {isNewUser && (
        <div className="border border-border rounded-xl p-5 mb-6 bg-surface">
          <div className="text-sm font-semibold mb-4">Getting Started</div>
          <div className="space-y-3">
            <ChecklistItem done={true} label="Account created" />
            <ChecklistItem done={true} label="API key saved" href="/keys" />
            <ChecklistItem done={hasBalance} label="Add funds" href="/wallet" />
            <ChecklistItem done={hasApiCalls} label="Make first API call" href="/quickstart" />
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          <a
            href="/wallet"
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            View all
          </a>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Agent
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Description
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No transactions yet. <a href="/wallet" className="text-accent hover:text-green-400 transition-colors">Add funds</a> to get started.
                  </td>
                </tr>
              ) : (
                recentTx.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <TypeBadge type={tx.type} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tx.agentId ? agentMap[tx.agentId] || tx.agentId.slice(-8) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {tx.currency === 'usd_cents' && tx.amountUsdCents
                        ? formatUsdCents(tx.amountUsdCents)
                        : `${formatSats(tx.amountSats)} sats`}
                    </td>
                    <td className="px-4 py-3 text-muted truncate max-w-[200px]">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ done, label, href }: { done: boolean; label: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
        {done && (
          <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${done ? 'text-gray-500 line-through' : 'text-white'}`}>
        {label}
      </span>
    </div>
  );

  if (href && !done) {
    return (
      <a href={href} className="block hover:bg-background rounded px-2 py-1 -mx-2 transition-colors">
        {content}
      </a>
    );
  }

  return <div className="px-2 py-1 -mx-2">{content}</div>;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    credit_lightning: 'bg-green-500/20 text-green-400',
    credit_stripe: 'bg-emerald-500/20 text-emerald-400',
    debit_proxy_call: 'bg-gray-500/20 text-gray-400',
    refund: 'bg-blue-500/20 text-blue-400',
    withdrawal: 'bg-orange-500/20 text-orange-400',
  };

  const labels: Record<string, string> = {
    credit_lightning: 'lightning',
    credit_stripe: 'card',
    debit_proxy_call: 'api call',
    refund: 'refund',
    withdrawal: 'withdrawal',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {labels[type] || type.replace(/_/g, ' ')}
    </span>
  );
}
