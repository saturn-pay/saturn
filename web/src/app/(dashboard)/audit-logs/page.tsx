'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatDateTime, truncateId } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import type { AuditLog, Paginated } from '@/lib/types';

const LIMIT = 25;

export default function AuditLogsPage() {
  const { apiKey } = useAuth();
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    setError('');
    apiFetch<Paginated<AuditLog>>('/v1/admin/audit-logs', {
      apiKey,
      params: { limit: LIMIT, offset },
    })
      .then((res) => {
        setData(res.data);
        setTotal(res.total ?? 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => setLoading(false));
  }, [apiKey, offset]);

  if (loading && data.length === 0) {
    return <div className="text-sm text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  const columns = [
    {
      key: 'time',
      header: 'Time',
      render: (log: AuditLog) => (
        <span className="text-gray-500 text-xs">
          {formatDateTime(log.createdAt)}
        </span>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs text-gray-500">
          {truncateId(log.agentId)}
        </span>
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
      key: 'capability',
      header: 'Capability',
      render: (log: AuditLog) => (
        <span className="text-xs">{log.capability || '—'}</span>
      ),
    },
    {
      key: 'result',
      header: 'Policy',
      render: (log: AuditLog) => <PolicyBadge result={log.policyResult} />,
    },
    {
      key: 'quoted',
      header: 'Quoted',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs">
          {formatSats(log.quotedSats)}
        </span>
      ),
    },
    {
      key: 'charged',
      header: 'Charged',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs">
          {log.chargedSats !== null ? formatSats(log.chargedSats) : '—'}
        </span>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      render: (log: AuditLog) => (
        <span className="font-mono text-xs text-gray-500">
          {log.upstreamLatencyMs !== null ? `${log.upstreamLatencyMs}ms` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight mb-6">Audit Logs</h1>
      <DataTable
        columns={columns}
        data={data}
        total={total}
        offset={offset}
        limit={LIMIT}
        onPageChange={setOffset}
        rowKey={(log) => log.id}
      />
    </div>
  );
}

function PolicyBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    allowed: 'bg-green-50 text-green-700',
    denied: 'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[result] || 'bg-gray-100 text-gray-700'}`}
    >
      {result}
    </span>
  );
}
