'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatUsdCents, formatNumber, formatDateTime } from '@/lib/format';
import { LoadingPage } from '@/components/loading';
import { DataTable } from '@/components/data-table';
import type { AdminAgent, Policy, UpdatePolicyRequest, AuditLog, Paginated, Capability } from '@/lib/types';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const { apiKey } = useAuth();

  const [agent, setAgent] = useState<AdminAgent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable policy fields
  const [maxPerCall, setMaxPerCall] = useState<string>('');
  const [maxPerDay, setMaxPerDay] = useState<string>('');
  const [killSwitch, setKillSwitch] = useState(false);
  const [deniedCapabilities, setDeniedCapabilities] = useState<Set<string>>(new Set());

  // Track original values to detect changes
  const [originalMaxPerCall, setOriginalMaxPerCall] = useState<string>('');
  const [originalMaxPerDay, setOriginalMaxPerDay] = useState<string>('');
  const [originalDeniedCapabilities, setOriginalDeniedCapabilities] = useState<Set<string>>(new Set());

  const AUDIT_LIMIT = 10;

  // Check if there are unsaved changes
  const setsEqual = (a: Set<string>, b: Set<string>) =>
    a.size === b.size && [...a].every(x => b.has(x));

  const hasChanges =
    maxPerCall !== originalMaxPerCall ||
    maxPerDay !== originalMaxPerDay ||
    !setsEqual(deniedCapabilities, originalDeniedCapabilities);

  useEffect(() => {
    if (!apiKey || !agentId) return;

    setLoading(true);
    Promise.all([
      apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey }),
      apiFetch<Policy>(`/v1/agents/${agentId}/policy`, { apiKey }),
      apiFetch<Capability[]>('/v1/capabilities', { apiKey }),
    ])
      .then(([agents, pol, caps]) => {
        const foundAgent = agents.find(a => a.id === agentId);
        if (!foundAgent) {
          setError('Agent not found');
          return;
        }
        setAgent(foundAgent);
        setPolicy(pol);
        setCapabilities(caps);

        // Initialize form fields
        const initialMaxPerCall = pol.maxPerCallUsdCents ? (pol.maxPerCallUsdCents / 100).toString() : '';
        const initialMaxPerDay = pol.maxPerDayUsdCents ? (pol.maxPerDayUsdCents / 100).toString() : '';
        const initialDenied = new Set(pol.deniedCapabilities || []);

        setMaxPerCall(initialMaxPerCall);
        setMaxPerDay(initialMaxPerDay);
        setKillSwitch(pol.killSwitch);
        setDeniedCapabilities(initialDenied);

        // Store originals for change detection
        setOriginalMaxPerCall(initialMaxPerCall);
        setOriginalMaxPerDay(initialMaxPerDay);
        setOriginalDeniedCapabilities(initialDenied);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      })
      .finally(() => setLoading(false));
  }, [apiKey, agentId]);

  // Fetch audit logs for this agent
  useEffect(() => {
    if (!apiKey || !agentId) return;

    apiFetch<Paginated<AuditLog>>('/v1/admin/audit-logs', {
      apiKey,
      params: { limit: AUDIT_LIMIT, offset: auditOffset, agentId },
    })
      .then((logs) => {
        setAuditLogs(logs.data);
        setAuditTotal(logs.total ?? 0);
      })
      .catch(() => {});
  }, [apiKey, agentId, auditOffset]);

  const handleSavePolicy = async () => {
    if (!apiKey || !agentId) return;

    setSaving(true);
    setError('');

    const updates: UpdatePolicyRequest = {
      maxPerCallUsdCents: maxPerCall ? Math.round(parseFloat(maxPerCall) * 100) : null,
      maxPerDayUsdCents: maxPerDay ? Math.round(parseFloat(maxPerDay) * 100) : null,
      killSwitch,
      deniedCapabilities: deniedCapabilities.size > 0 ? Array.from(deniedCapabilities) : null,
    };

    try {
      const updated = await apiFetch<Policy>(`/v1/agents/${agentId}/policy`, {
        apiKey,
        method: 'PATCH',
        body: updates,
      });
      setPolicy(updated);
      const newDenied = new Set(updated.deniedCapabilities || []);
      setDeniedCapabilities(newDenied);

      // Update originals after successful save
      setOriginalMaxPerCall(maxPerCall);
      setOriginalMaxPerDay(maxPerDay);
      setOriginalDeniedCapabilities(newDenied);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  const handleKillSwitch = async (enabled: boolean) => {
    if (!apiKey || !agentId) return;

    setSaving(true);
    try {
      await apiFetch(`/v1/agents/${agentId}/policy/${enabled ? 'kill' : 'unkill'}`, {
        apiKey,
        method: 'POST',
      });
      setKillSwitch(enabled);
      if (policy) {
        setPolicy({ ...policy, killSwitch: enabled });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle kill switch');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error && !agent) {
    return (
      <div>
        <button onClick={() => router.push('/keys')} className="text-sm text-muted hover:text-white mb-4">
          &larr; Back to Keys
        </button>
        <div className="text-sm text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/keys')} className="text-sm text-muted hover:text-white mb-2 block">
            &larr; Back to Keys
          </button>
          <h1 className="text-2xl font-bold tracking-tight">{agent?.name}</h1>
          <p className="text-sm text-muted mt-1">
            Created {agent ? formatDateTime(agent.createdAt) : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={agent?.status || 'active'} />
          {killSwitch && (
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
              Kill Switch Active
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Today&apos;s Spend</div>
          <div className="text-2xl font-bold font-mono">
            {formatUsdCents(agent?.lifetimeOutUsdCents ?? 0)}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Lifetime Spend</div>
          <div className="text-2xl font-bold font-mono">
            {formatUsdCents(agent?.lifetimeOutUsdCents ?? 0)}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">API Calls</div>
          <div className="text-2xl font-bold font-mono">
            {formatNumber(auditTotal)}
          </div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Role</div>
          <div className="text-2xl font-bold font-mono capitalize">
            {agent?.role || 'worker'}
          </div>
        </div>
      </div>

      {/* Policy Settings */}
      <div className="border border-border rounded-xl p-6 mb-6 bg-surface">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold">Policy Settings</h2>
          <button
            onClick={handleSavePolicy}
            disabled={saving || !hasChanges}
            className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-400 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Spend Limits */}
          <div>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Spend Limits</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Max per call</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                    value={maxPerCall}
                    onChange={(e) => setMaxPerCall(e.target.value)}
                    className="w-32 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-accent transition-all"
                  />
                </div>
                <p className="text-xs text-muted mt-1">Maximum cost allowed per API call</p>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Max per day</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No limit"
                    value={maxPerDay}
                    onChange={(e) => setMaxPerDay(e.target.value)}
                    className="w-32 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-accent transition-all"
                  />
                </div>
                {policy?.maxPerDayUsdCents ? (
                  <DailySpendProgress
                    spent={Math.round((agent?.todaySpendSats ?? 0) * 0.04)}
                    limit={policy.maxPerDayUsdCents}
                  />
                ) : (
                  <p className="text-xs text-muted mt-1">Maximum daily spend for this agent</p>
                )}
              </div>
            </div>
          </div>

          {/* Kill Switch */}
          <div>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Emergency Controls</h3>
            <div className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Kill Switch</div>
                  <p className="text-xs text-muted mt-1">Block all API calls for this agent</p>
                </div>
                <button
                  onClick={() => handleKillSwitch(!killSwitch)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    killSwitch ? 'bg-red-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      killSwitch ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Service/Capability Restrictions */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Capabilities</h3>
          <div className="grid grid-cols-2 gap-3">
            {capabilities.map((cap) => {
              const isEnabled = !deniedCapabilities.has(cap.capability);
              return (
                <div
                  key={cap.capability}
                  className="flex items-center justify-between bg-background border border-border rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-mono">{cap.capability}</span>
                    <p className="text-xs text-muted mt-0.5">{cap.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = new Set(deniedCapabilities);
                      if (isEnabled) {
                        next.add(cap.capability);
                      } else {
                        next.delete(cap.capability);
                      }
                      setDeniedCapabilities(next);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-green-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-3">
            Toggle capabilities on or off for this agent. Changes apply after saving.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="font-semibold mb-4">Recent Activity</h2>
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
              key: 'service',
              header: 'Service',
              render: (log: AuditLog) => (
                <span className="font-mono text-xs">{log.serviceSlug}</span>
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
          rowKey={(log) => log.id}
          emptyMessage="No activity yet for this agent."
        />
      </div>
    </div>
  );
}

function formatCharge(log: AuditLog): string {
  if (log.chargedUsdCents !== null && log.chargedUsdCents !== undefined) {
    return formatUsdCents(log.chargedUsdCents);
  }
  if (log.chargedSats !== null && log.chargedSats !== undefined) {
    return formatUsdCents(Math.round(log.chargedSats * 0.04));
  }
  return '—';
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-yellow-500/20 text-yellow-400',
    killed: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}

function PolicyBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    allowed: 'bg-green-500/20 text-green-400',
    denied: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[result] || 'bg-gray-500/20 text-gray-400'}`}>
      {result === 'allowed' ? 'success' : result}
    </span>
  );
}

function DailySpendProgress({ spent, limit }: { spent: number; limit: number }) {
  const percentage = Math.min((spent / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">
          {formatUsdCents(spent)} / {formatUsdCents(limit)}
        </span>
        <span className={isOverLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-muted'}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
