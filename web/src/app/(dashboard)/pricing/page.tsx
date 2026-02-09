'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { Capability } from '@/lib/types';

function formatUsdMicros(micros: number): string {
  return (micros / 1000000).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export default function PricingPage() {
  const { apiKey } = useAuth();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    apiFetch<Capability[]>('/v1/capabilities', { apiKey })
      .then(setCapabilities)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load pricing');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Pricing</h1>
      <p className="text-sm text-muted mb-8">
        Pay only for what you use. No minimums, no commitments.
      </p>

      {capabilities.length === 0 ? (
        <div className="border border-border rounded-xl p-8 text-center text-muted">
          No capabilities available yet.
        </div>
      ) : (
        <div className="space-y-4">
          {capabilities.map((cap) => (
            <div key={cap.capability} className="border border-border rounded-xl p-5 bg-surface hover:border-zinc-600 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-semibold bg-background px-2.5 py-1 rounded-lg border border-border text-accent">
                      saturn.{cap.capability}()
                    </code>
                  </div>
                  <p className="text-sm text-muted">{cap.description}</p>
                </div>
              </div>

              <div className="bg-background rounded-lg p-4 border border-border">
                <div className="text-xs text-muted uppercase tracking-wider mb-3">Pricing</div>
                <div className="space-y-2">
                  {cap.pricing.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">
                        {p.operation}
                        <span className="text-muted ml-1">({p.unit.replace(/_/g, ' ')})</span>
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-accent">
                          {formatUsdMicros(p.priceUsdMicros)}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {p.priceSats} sats
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-muted">
                Providers: {cap.providers.map(p => p.slug).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
