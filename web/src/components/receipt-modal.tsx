'use client';

import type { AuditLog } from '@/lib/types';
import { formatDateTime, formatUsdCents } from '@/lib/format';

interface ReceiptModalProps {
  log: AuditLog;
  agentName: string;
  onClose: () => void;
}

function formatCharge(log: AuditLog): string {
  // Try USD cents first
  const cents = log.chargedUsdCents ?? log.quotedUsdCents;
  if (cents !== null && cents !== undefined && cents > 0) {
    const dollars = cents / 100;
    if (dollars < 0.01) {
      return '$' + dollars.toFixed(4);
    }
    return '$' + dollars.toFixed(2);
  }
  // Fallback: convert sats to USD (approx $40k BTC = 0.04 cents per sat)
  const sats = log.chargedSats ?? log.quotedSats;
  if (sats !== null && sats !== undefined && sats > 0) {
    const usdCents = sats * 0.04;
    const dollars = usdCents / 100;
    if (dollars < 0.01) {
      return '$' + dollars.toFixed(4);
    }
    return '$' + dollars.toFixed(2);
  }
  return '—';
}

export function ReceiptModal({ log, agentName, onClose }: ReceiptModalProps) {
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
