'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatSats, formatDateTime, truncateId } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import type { AdminTransaction, Paginated } from '@/lib/types';

const LIMIT = 25;

export default function TransactionsPage() {
  const { apiKey } = useAuth();
  const [data, setData] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    setError('');
    apiFetch<Paginated<AdminTransaction>>('/v1/admin/transactions', {
      apiKey,
      params: { limit: LIMIT, offset },
    })
      .then((res) => {
        setData(res.data);
        setTotal(res.total ?? 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
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
      key: 'id',
      header: 'ID',
      render: (tx: AdminTransaction) => (
        <span className="font-mono text-xs text-gray-500">
          {truncateId(tx.id)}
        </span>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (tx: AdminTransaction) => (
        <span className="font-mono text-xs text-gray-500">
          {truncateId(tx.agentId)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (tx: AdminTransaction) => <TypeBadge type={tx.type} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (tx: AdminTransaction) => (
        <span className="font-mono text-xs">{formatSats(tx.amountSats)}</span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Balance After',
      render: (tx: AdminTransaction) => (
        <span className="font-mono text-xs text-gray-500">
          {formatSats(tx.balanceAfter)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (tx: AdminTransaction) => (
        <span className="text-gray-600 truncate block max-w-[200px]">
          {tx.description}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (tx: AdminTransaction) => (
        <span className="text-gray-500 text-xs">
          {formatDateTime(tx.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight mb-6">Transactions</h1>
      <DataTable
        columns={columns}
        data={data}
        total={total}
        offset={offset}
        limit={LIMIT}
        onPageChange={setOffset}
        rowKey={(tx) => tx.id}
      />
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    credit_lightning: 'bg-green-50 text-green-700',
    debit_proxy_call: 'bg-gray-100 text-gray-700',
    refund: 'bg-blue-50 text-blue-700',
    withdrawal: 'bg-orange-50 text-orange-700',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}
