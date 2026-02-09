'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatUsdCents, formatDateTime } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import type { AdminStats, AdminTransaction, AdminAgent, Paginated, Wallet, AuditLog } from '@/lib/types';

const CHART_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export default function DashboardHome() {
  const { apiKey } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentTx, setRecentTx] = useState<AdminTransaction[]>([]);
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const AUDIT_LIMIT = 10;

  // Map agentId to agent name
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [agents]);

  // Calculate service breakdown
  const serviceBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    auditLogs.forEach((log) => {
      const key = log.serviceSlug || 'unknown';
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }, [auditLogs]);

  // Calculate agent breakdown
  const agentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    auditLogs.forEach((log) => {
      const key = log.agentId;
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([agentId, count]) => ({
        agentId,
        name: agentMap[agentId] || agentId.slice(-8),
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [auditLogs, agentMap]);

  const totalForChart = serviceBreakdown.reduce((acc, s) => acc + s.count, 0);

  // Color maps for consistent colors across charts and table
  const serviceColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    serviceBreakdown.forEach((item, index) => {
      map[item.service] = CHART_COLORS[index % CHART_COLORS.length];
    });
    return map;
  }, [serviceBreakdown]);

  const agentColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    agentBreakdown.forEach((item, index) => {
      map[item.agentId] = CHART_COLORS[(index + 4) % CHART_COLORS.length];
    });
    return map;
  }, [agentBreakdown]);

  // Check if user is new
  const isNewUser = recentTx.length === 0 && !loading;
  const hasBalance = (wallet?.balanceUsdCents ?? 0) > 0 || (wallet?.balanceSats ?? 0) > 0;
  const hasApiCalls = (stats?.totalTransactions ?? 0) > 0;

  // Initial data fetch
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

  // Paginated audit logs fetch
  useEffect(() => {
    if (!apiKey) return;

    apiFetch<Paginated<AuditLog>>('/v1/admin/audit-logs', {
      apiKey,
      params: { limit: AUDIT_LIMIT, offset: auditOffset },
    })
      .then((logs) => {
        setAuditLogs(logs.data);
        setAuditTotal(logs.total ?? 0);
      })
      .catch(() => {});
  }, [apiKey, auditOffset]);

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
      <div className="grid grid-cols-4 gap-4 mb-6">
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
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Services Used</div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {serviceBreakdown.length}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Active Agents</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold font-mono text-blue-400">
              {agents.length}
            </div>
            <a href="/keys" className="btn-primary px-3 py-1.5 rounded-lg text-xs">
              + New
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

      {/* Usage Breakdown - only show if there's data */}
      {totalForChart > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Service Breakdown */}
          <div className="border border-border rounded-xl p-5 bg-surface">
            <div className="text-xs text-muted uppercase tracking-wider mb-4">Usage by Service</div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  {serviceBreakdown.reduce((acc, item, index) => {
                    const percentage = (item.count / totalForChart) * 100;
                    const dashArray = `${percentage} ${100 - percentage}`;
                    const dashOffset = -acc.offset;
                    acc.elements.push(
                      <circle
                        key={item.service}
                        r="16"
                        cx="18"
                        cy="18"
                        fill="transparent"
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        strokeWidth="3"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        className="transition-all duration-200"
                      >
                        <title>{item.service}: {item.count} ({percentage.toFixed(0)}%)</title>
                      </circle>
                    );
                    acc.offset += percentage;
                    return acc;
                  }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                  <circle cx="18" cy="18" r="12" className="fill-background" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                {serviceBreakdown.slice(0, 4).map((item, index) => (
                  <div key={item.service} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-muted">{item.service}</span>
                    </div>
                    <span className="font-mono">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Breakdown */}
          <div className="border border-border rounded-xl p-5 bg-surface">
            <div className="text-xs text-muted uppercase tracking-wider mb-4">Usage by Agent</div>
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  {agentBreakdown.reduce((acc, item, index) => {
                    const percentage = (item.count / totalForChart) * 100;
                    const dashArray = `${percentage} ${100 - percentage}`;
                    const dashOffset = -acc.offset;
                    acc.elements.push(
                      <circle
                        key={item.agentId}
                        r="16"
                        cx="18"
                        cy="18"
                        fill="transparent"
                        stroke={CHART_COLORS[(index + 4) % CHART_COLORS.length]}
                        strokeWidth="3"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        className="transition-all duration-200"
                      >
                        <title>{item.name}: {item.count} ({percentage.toFixed(0)}%)</title>
                      </circle>
                    );
                    acc.offset += percentage;
                    return acc;
                  }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                  <circle cx="18" cy="18" r="12" className="fill-background" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                {agentBreakdown.slice(0, 4).map((item, index) => (
                  <div key={item.agentId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[(index + 4) % CHART_COLORS.length] }}
                      />
                      <span className="text-muted truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="font-mono">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Usage Log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">API Usage</h2>
        </div>

        <DataTable
          columns={[
            {
              key: 'time',
              header: 'Time',
              render: (log: AuditLog) => (
                <span className="text-muted text-xs">{formatDateTime(log.createdAt)}</span>
              ),
            },
            {
              key: 'agent',
              header: 'Agent',
              render: (log: AuditLog) => (
                <span className="text-xs flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: agentColorMap[log.agentId] || '#6b7280' }}
                  />
                  {agentMap[log.agentId] || log.agentId.slice(-8)}
                </span>
              ),
            },
            {
              key: 'service',
              header: 'Service',
              render: (log: AuditLog) => (
                <span className="font-mono text-xs flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: serviceColorMap[log.serviceSlug] || '#6b7280' }}
                  />
                  {log.serviceSlug}
                </span>
              ),
            },
            {
              key: 'operation',
              header: 'Operation',
              render: (log: AuditLog) => (
                <span className="text-xs text-muted">{log.capability || log.operation || '—'}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (log: AuditLog) => <PolicyBadge result={log.policyResult} />,
            },
            {
              key: 'cost',
              header: 'Cost',
              render: (log: AuditLog) => (
                <span className="font-mono text-xs">
                  {log.chargedSats !== null ? `${formatSats(log.chargedSats)} sats` : '—'}
                </span>
              ),
            },
          ]}
          data={auditLogs}
          total={auditTotal}
          offset={auditOffset}
          limit={AUDIT_LIMIT}
          onPageChange={setAuditOffset}
          rowKey={(log) => log.id}
          emptyMessage="No API calls yet. Check out the quickstart guide to make your first call."
        />
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

function PolicyBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    allowed: 'bg-green-500/20 text-green-400',
    denied: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[result] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {result === 'allowed' ? 'success' : result}
    </span>
  );
}
