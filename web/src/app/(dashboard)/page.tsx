'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatUsdCents, formatDateTime } from '@/lib/format';
import { StatCard } from '@/components/stat-card';
import type { AdminStats, AdminTransaction, Paginated, RateInfo } from '@/lib/types';

export default function DashboardHome() {
  const { apiKey } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rate, setRate] = useState<RateInfo | null>(null);
  const [recentTx, setRecentTx] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey) return;

    Promise.all([
      apiFetch<AdminStats>('/v1/admin/stats', { apiKey }),
      apiFetch<RateInfo>('/v1/admin/rates', { apiKey }),
      apiFetch<Paginated<AdminTransaction>>('/v1/admin/transactions', {
        apiKey,
        params: { limit: 5 },
      }),
    ])
      .then(([s, r, tx]) => {
        setStats(s);
        setRate(r);
        setRecentTx(tx.data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight mb-6">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Sats In" value={formatSats(stats?.satsIn ?? 0)} />
        <StatCard label="Sats Out" value={formatSats(stats?.satsOut ?? 0)} />
        <StatCard label="USD In" value={formatUsdCents(stats?.usdCentsIn ?? 0)} />
        <StatCard label="USD Out" value={formatUsdCents(stats?.usdCentsOut ?? 0)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Agents"
          value={String(stats?.activeAgents ?? 0)}
        />
        <StatCard
          label="Transactions"
          value={formatSats(stats?.totalTransactions ?? 0)}
        />
      </div>

      {rate && (
        <div className="border border-border rounded-lg p-5 mb-8">
          <div className="text-xs text-gray-500 mb-1">BTC / USD</div>
          <div className="text-lg font-bold">
            ${rate.current.usdPerBtc.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {rate.current.satsPerUsd.toLocaleString()} sats/USD
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Transactions</h2>
          <a
            href="/transactions"
            className="text-xs text-gray-500 hover:text-black transition-colors"
          >
            View all
          </a>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No transactions yet
                  </td>
                </tr>
              ) : (
                recentTx.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <TypeBadge type={tx.type} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {tx.currency === 'usd_cents' && tx.amountUsdCents
                        ? formatUsdCents(tx.amountUsdCents)
                        : `${formatSats(tx.amountSats)} sats`}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
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

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    credit_lightning: 'bg-green-50 text-green-700',
    credit_stripe: 'bg-emerald-50 text-emerald-700',
    debit_proxy_call: 'bg-gray-100 text-gray-700',
    refund: 'bg-blue-50 text-blue-700',
    withdrawal: 'bg-orange-50 text-orange-700',
  };

  const labels: Record<string, string> = {
    credit_lightning: 'lightning',
    credit_stripe: 'card',
    debit_proxy_call: 'proxy call',
    refund: 'refund',
    withdrawal: 'withdrawal',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}
    >
      {labels[type] || type.replace(/_/g, ' ')}
    </span>
  );
}
