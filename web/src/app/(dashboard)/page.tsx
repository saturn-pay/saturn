'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatNumber, formatUsdCents, formatDateTime } from '@/lib/format';
import { LoadingPage } from '@/components/loading';
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
  const [allAuditLogs, setAllAuditLogs] = useState<AuditLog[]>([]); // For charts - all data
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const AUDIT_LIMIT = 10;

  // Map agentId to agent name
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [agents]);

  // Calculate service breakdown from ALL audit logs
  const serviceBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    allAuditLogs.forEach((log) => {
      const key = log.serviceSlug || 'unknown';
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }, [allAuditLogs]);

  // Calculate agent breakdown from ALL audit logs
  const agentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    allAuditLogs.forEach((log) => {
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
  }, [allAuditLogs, agentMap]);

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
  const hasBalance = (wallet?.balanceUsdCents ?? 0) > 0;
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
      // Fetch all audit logs for charts (up to 1000)
      apiFetch<Paginated<AuditLog>>('/v1/admin/audit-logs', {
        apiKey,
        params: { limit: 1000 },
      }),
    ])
      .then(([w, s, tx, ag, allLogs]) => {
        setWallet(w);
        setStats(s);
        setRecentTx(tx.data);
        setAgents(ag);
        setAllAuditLogs(allLogs.data);
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
    return <LoadingPage />;
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
            {formatNumber(stats?.totalTransactions ?? 0)}
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
                  {formatCharge(log)}
                </span>
              ),
            },
          ]}
          data={auditLogs}
          total={auditTotal}
          offset={auditOffset}
          limit={AUDIT_LIMIT}
          onPageChange={setAuditOffset}
          onRowClick={(log) => setSelectedLog(log)}
          rowKey={(log) => log.id}
          emptyMessage="No API calls yet. Check out the quickstart guide to make your first call."
        />

        {/* Receipt Modal */}
        {selectedLog && (
          <ReceiptModal
            log={selectedLog}
            agentName={agentMap[selectedLog.agentId] || selectedLog.agentId.slice(-8)}
            onClose={() => setSelectedLog(null)}
          />
        )}
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

function formatCharge(log: AuditLog): string {
  if (log.chargedUsdCents !== null && log.chargedUsdCents !== undefined) {
    return formatUsdCents(log.chargedUsdCents);
  }
  if (log.chargedSats !== null && log.chargedSats !== undefined) {
    // Convert sats to approximate USD (rough estimate: 1 sat ≈ $0.0004 at ~$40k BTC)
    // For now just show as cents equivalent
    return formatUsdCents(Math.round(log.chargedSats * 0.04));
  }
  return '—';
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

function ReceiptModal({ log, agentName, onClose }: { log: AuditLog; agentName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-background">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
            <span className="w-3 h-3 rounded-full bg-zinc-600" />
          </div>
          <span className="text-sm text-muted ml-2">receipt</span>
          <button
            onClick={onClose}
            className="ml-auto text-muted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="text-xs text-muted uppercase tracking-wider mb-4">
            API Call Receipt
          </div>

          <div className="space-y-3">
            <ReceiptRow label="capability" value={log.capability || log.operation || '—'} />
            <ReceiptRow label="service" value={log.serviceSlug} />
            <ReceiptRow label="agent" value={agentName} />
            <ReceiptRow
              label="charged"
              value={formatCharge(log)}
              highlight
            />
            <ReceiptRow
              label="status"
              value={
                <span className={log.policyResult === 'allowed' ? 'text-green-400' : 'text-red-400'}>
                  {log.policyResult === 'allowed' ? 'success' : log.policyResult}
                </span>
              }
            />
            {log.policyReason && (
              <ReceiptRow label="policy_reason" value={log.policyReason} />
            )}
            <ReceiptRow
              label="latency"
              value={log.upstreamLatencyMs ? `${log.upstreamLatencyMs}ms` : '—'}
            />
            <ReceiptRow label="audit_id" value={log.id.slice(0, 8) + '...' + log.id.slice(-4)} mono />
            <ReceiptRow label="timestamp" value={formatDateTime(log.createdAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm ${highlight ? 'text-white font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
