'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatDate } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import type { AdminAgent } from '@/lib/types';

export default function AgentsPage() {
  const { apiKey } = useAuth();
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    apiFetch<AdminAgent[]>('/v1/admin/agents', { apiKey })
      .then(setAgents)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (a: AdminAgent) => (
        <span className="font-medium">{a.name}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a: AdminAgent) => <StatusBadge status={a.status} />,
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (a: AdminAgent) => (
        <span className="font-mono text-xs">{formatSats(a.balanceSats)}</span>
      ),
    },
    {
      key: 'todaySpend',
      header: 'Today',
      render: (a: AdminAgent) => (
        <span className="font-mono text-xs text-gray-500">
          {formatSats(a.todaySpendSats)}
        </span>
      ),
    },
    {
      key: 'lifetime',
      header: 'In / Out',
      render: (a: AdminAgent) => (
        <span className="font-mono text-xs text-gray-500">
          {formatSats(a.lifetimeIn)} / {formatSats(a.lifetimeOut)}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (a: AdminAgent) => (
        <span className="text-gray-500 text-xs">{formatDate(a.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight mb-6">Agents</h1>
      <DataTable
        columns={columns}
        data={agents}
        offset={0}
        limit={agents.length}
        onPageChange={() => {}}
        rowKey={(a) => a.id}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-50 text-green-700',
    suspended: 'bg-yellow-50 text-yellow-700',
    killed: 'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}
