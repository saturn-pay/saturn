'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatUsdCents, formatBrlCents, formatDateTime } from '@/lib/format';
import { LoadingPage } from '@/components/loading';
import { DataTable } from '@/components/data-table';
import type { Wallet, Transaction, Paginated, FundCardResponse } from '@/lib/types';

const PRESET_AMOUNTS = [500, 1000, 2500, 5000]; // cents
const LIMIT = 25;

export default function WalletPage() {
  const { apiKey } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Funding state
  const [selectedAmount, setSelectedAmount] = useState<number>(1000); // $10 default
  const [customAmount, setCustomAmount] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<FundCardResponse | null>(null);

  const fundAmountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : selectedAmount;

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    Promise.all([
      apiFetch<Wallet>('/v1/wallet', { apiKey }),
      // Fetch more to account for filtering (API usage is shown on home page)
      apiFetch<Paginated<Transaction>>('/v1/wallet/transactions', {
        apiKey,
        params: { limit: 100, offset: 0 },
      }),
    ])
      .then(([w, tx]) => {
        setWallet(w);
        // Only show billing transactions (credits & refunds), not API call debits
        const billingTypes = ['credit_lightning', 'credit_stripe', 'refund'];
        const billingTx = tx.data.filter((t) => billingTypes.includes(t.type));
        setTransactions(billingTx);
        setTotal(billingTx.length);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load wallet data');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  const handleFundCard = async () => {
    if (!apiKey || fundAmountCents < 100) return;
    setFundingLoading(true);
    setFundingError('');

    try {
      const response = await apiFetch<FundCardResponse>('/v1/wallet/fund-card', {
        apiKey,
        method: 'POST',
        body: { amountUsdCents: fundAmountCents },
      });
      // Show confirmation modal with BRL amount
      setPendingCheckout(response);
      setFundingLoading(false);
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Failed to start checkout');
      setFundingLoading(false);
    }
  };

  const handleConfirmPayment = () => {
    if (pendingCheckout) {
      window.location.href = pendingCheckout.checkoutUrl;
    }
  };

  const handleCancelPayment = () => {
    setPendingCheckout(null);
  };


  if (loading && !wallet) {
    return <LoadingPage />;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (tx: Transaction) => <TypeBadge type={tx.type} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (tx: Transaction) => (
        <span className="font-mono text-xs">
          {formatUsdCents(tx.amountUsdCents ?? 0)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (tx: Transaction) => (
        <span className="text-muted truncate max-w-[200px] block">{tx.description}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (tx: Transaction) => (
        <span className="text-muted text-xs">{formatDateTime(tx.createdAt)}</span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Wallet</h1>

      {/* Balance Display */}
      <div className="border border-border rounded-xl p-6 mb-8 bg-surface">
        <div className="text-sm text-muted mb-1">Available Balance</div>
        <div className="text-4xl font-bold text-accent font-mono tracking-tight">
          {formatUsdCents(wallet?.balanceUsdCents ?? 0)}
        </div>
      </div>

      {/* Funding Section */}
      <div className="border border-border rounded-xl p-6 mb-8 bg-surface">
        <div className="text-sm font-semibold mb-5">Add Funds</div>

        {/* Preset Amounts */}
        <div className="flex gap-2 mb-5">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount('');
              }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                selectedAmount === amount && !customAmount
                  ? 'btn-primary'
                  : 'bg-background border border-border hover:border-zinc-500'
              }`}
            >
              {formatUsdCents(amount)}
            </button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="mb-5">
          <label className="text-xs text-muted block mb-2">Custom amount</label>
          <div className="flex items-center gap-2">
            <span className="text-muted">$</span>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-32 px-3 py-2.5 bg-background border border-border rounded-lg text-sm font-mono outline-none focus:border-accent transition-all"
            />
          </div>
        </div>

        {/* Payment Action */}
        <button
          onClick={handleFundCard}
          disabled={fundingLoading || fundAmountCents < 100}
          className="btn-primary px-5 py-2.5 rounded-lg text-sm"
        >
          {fundingLoading ? 'Processing...' : `Add ${formatUsdCents(fundAmountCents)}`}
        </button>

        {fundingError && (
          <div className="mt-4 text-sm text-red-400">{fundingError}</div>
        )}
      </div>

      {/* Billing History */}
      <div>
        <div className="text-sm font-semibold mb-5">Billing History</div>
        <DataTable
          columns={columns}
          data={transactions.slice(offset, offset + LIMIT)}
          total={total}
          offset={offset}
          limit={LIMIT}
          onPageChange={setOffset}
          rowKey={(tx) => tx.id}
          emptyMessage="No billing transactions yet. Add funds above to get started."
        />
      </div>

      {/* BRL Confirmation Modal */}
      {pendingCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Confirm Payment</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted">You selected:</span>
                <span className="font-medium">{formatUsdCents(pendingCheckout.amountUsdCents)}</span>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-muted text-sm">You&apos;ll be charged:</span>
                  <span className="text-2xl font-bold text-accent">{formatBrlCents(pendingCheckout.amountBrlCents)}</span>
                </div>
                <div className="text-xs text-muted mt-1 text-right">
                  Rate: 1 USD = {pendingCheckout.usdBrlRate.toFixed(2)} BRL
                </div>
              </div>

              <p className="text-xs text-muted bg-background rounded-lg p-3">
                Your card will be charged in Brazilian Reais (BRL). Your bank may apply additional currency conversion fees.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelPayment}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-background border border-border hover:border-zinc-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 btn-primary px-4 py-2.5 rounded-lg text-sm font-medium"
              >
                Continue to Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
