'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatDateTime } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import type { AuditLog, AdminAgent, Paginated } from '@/lib/types';

const LIMIT = 25;

// Colors for pie chart segments
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

export default function UsagePage() {
  const { apiKey } = useAuth();
  const [data, setData] = useState<AuditLog[]>([]);
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Summary stats
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalSpend, setTotalSpend] = useState(0);

  // Map agentId to agent name
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [agents]);

  // Calculate service breakdown for pie chart (from current filtered data)
  const serviceBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    data.forEach((log) => {
      const key = log.serviceSlug || 'unknown';
      breakdown[key] = (breakdown[key] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Calculate agent breakdown
  const agentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    data.forEach((log) => {
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
  }, [data, agentMap]);

  // Totals for stats
  const uniqueServices = serviceBreakdown.length;
  const uniqueAgents = agentBreakdown.length;

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

  // Fetch agents on mount
  useEffect(() => {
    if (!apiKey) return;
    apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey })
      .then(setAgents)
      .catch(() => {});
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    const params: Record<string, string | number> = { limit: LIMIT, offset };
    if (selectedAgent !== 'all') {
      params.agent_id = selectedAgent;
    }

    apiFetch<Paginated<AuditLog>>('/v1/admin/audit-logs', {
      apiKey,
      params,
    })
      .then((res) => {
        setData(res.data);
        setTotal(res.total ?? 0);
        const spend = res.data.reduce((acc, l) => acc + (l.chargedSats ?? 0), 0);
        setTotalCalls(res.total ?? 0);
        setTotalSpend(spend);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load usage data');
      })
      .finally(() => setLoading(false));
  }, [apiKey, offset, selectedAgent]);

  // Reset offset when agent filter changes
  const handleAgentChange = (agentId: string) => {
    setSelectedAgent(agentId);
    setOffset(0);
  };

  if (loading && data.length === 0) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  const columns = [
    {
      key: 'time',
      header: 'Time',
      render: (log: AuditLog) => (
        <span className="text-muted text-xs">
          {formatDateTime(log.createdAt)}
        </span>
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
      key: 'capability',
      header: 'Operation',
      render: (log: AuditLog) => (
        <span className="text-xs text-muted">{log.capability || log.operation || '—'}</span>
      ),
    },
    {
      key: 'result',
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
    {
      key: 'latency',
      header: 'Latency',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs text-muted">
          {log.upstreamLatencyMs !== null ? `${log.upstreamLatencyMs}ms` : '—'}
        </span>
      ),
    },
  ];

  const totalForChart = serviceBreakdown.reduce((acc, s) => acc + s.count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Usage</h1>
          <p className="text-sm text-muted">
            Track your API calls and costs.
          </p>
        </div>

        {/* Agent Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Agent:</span>
          <select
            value={selectedAgent}
            onChange={(e) => handleAgentChange(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent transition-all"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Total API Calls</div>
          <div className="text-3xl font-bold font-mono">{formatSats(totalCalls)}</div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Total Spend</div>
          <div className="text-3xl font-bold font-mono text-accent">{formatSats(totalSpend)}<span className="text-lg text-muted ml-1">sats</span></div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Active Agents</div>
          <div className="text-3xl font-bold font-mono text-blue-400">{uniqueAgents}</div>
        </div>
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="text-xs text-muted uppercase tracking-wider mb-2">Services Used</div>
          <div className="text-3xl font-bold font-mono text-amber-400">{uniqueServices}</div>
        </div>
      </div>

      {/* Pie Chart + Service Grid */}
      {serviceBreakdown.length > 0 && (
        <div className="border border-border rounded-xl p-5 bg-surface mb-6">
          <div className="text-xs text-muted uppercase tracking-wider mb-4">Usage by Service</div>
          <div className="flex items-start gap-8">
            {/* Pie Chart with Hover */}
            <div className="relative">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                {serviceBreakdown.reduce((acc, item, index) => {
                  const percentage = (item.count / totalForChart) * 100;
                  const circumference = 100;
                  const dashArray = `${percentage} ${circumference - percentage}`;
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
                      className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                      style={{ strokeLinecap: 'round' }}
                    >
                      <title>{item.service}: {item.count} calls ({percentage.toFixed(1)}%)</title>
                    </circle>
                  );
                  acc.offset += percentage;
                  return acc;
                }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                {/* Center hole */}
                <circle cx="18" cy="18" r="13" className="fill-background" />
              </svg>
            </div>

            {/* Service Grid with Colors */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {serviceBreakdown.map((item, index) => {
                const percentage = ((item.count / totalForChart) * 100).toFixed(1);
                const color = CHART_COLORS[index % CHART_COLORS.length];
                return (
                  <div
                    key={item.service}
                    className="rounded-lg p-3 transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}
                  >
                    <div className="text-xs font-medium mb-1">{item.service}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold font-mono">{item.count}</span>
                      <span className="text-xs text-muted">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Agent Breakdown */}
      {agentBreakdown.length > 0 && selectedAgent === 'all' && (
        <div className="border border-border rounded-xl p-5 bg-surface mb-6">
          <div className="text-xs text-muted uppercase tracking-wider mb-4">Usage by Agent</div>
          <div className="flex items-start gap-8">
            {/* Pie Chart for Agents */}
            <div className="relative">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                {agentBreakdown.reduce((acc, item, index) => {
                  const percentage = (item.count / totalForChart) * 100;
                  const circumference = 100;
                  const dashArray = `${percentage} ${circumference - percentage}`;
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
                      className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                      style={{ strokeLinecap: 'round' }}
                    >
                      <title>{item.name}: {item.count} calls ({percentage.toFixed(1)}%)</title>
                    </circle>
                  );
                  acc.offset += percentage;
                  return acc;
                }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                {/* Center hole */}
                <circle cx="18" cy="18" r="13" className="fill-background" />
              </svg>
            </div>

            {/* Agent Grid with Colors */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {agentBreakdown.map((item, index) => {
                const percentage = ((item.count / totalForChart) * 100).toFixed(1);
                const color = CHART_COLORS[(index + 4) % CHART_COLORS.length];
                return (
                  <div
                    key={item.agentId}
                    className="rounded-lg p-3 transition-all hover:scale-[1.02] cursor-pointer"
                    style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}
                    onClick={() => handleAgentChange(item.agentId)}
                  >
                    <div className="text-xs font-medium mb-1">{item.name}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold font-mono">{item.count}</span>
                      <span className="text-xs text-muted">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Usage Table */}
      <DataTable
        columns={columns}
        data={data}
        total={total}
        offset={offset}
        limit={LIMIT}
        onPageChange={setOffset}
        rowKey={(log) => log.id}
        emptyMessage="No API calls yet. Make your first call to see usage here."
      />
    </div>
  );
}

function PolicyBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    allowed: 'bg-green-500/20 text-green-400',
    denied: 'bg-red-500/20 text-red-400',
  };

  const labels: Record<string, string> = {
    allowed: 'success',
    denied: 'denied',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[result] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {labels[result] || result}
    </span>
  );
}
