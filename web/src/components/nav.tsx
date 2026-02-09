'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatUsdCents } from '@/lib/format';
import type { Wallet } from '@/lib/types';

export function Nav() {
  const { apiKey, account, logout } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    apiFetch<Wallet>('/v1/wallet', { apiKey })
      .then(setWallet)
      .catch(() => {
        // Silently fail - balance just won't show
      });
  }, [apiKey]);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between max-w-[1200px] mx-auto px-8 h-14">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-background" />
          </div>
          <span className="font-bold text-[15px] tracking-tight">Saturn</span>
        </a>
        <div className="flex items-center gap-1 text-sm">
          {wallet && (
            <a
              href="/wallet"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface transition-all"
            >
              <span className="font-mono font-semibold text-accent">
                {formatUsdCents(wallet.balanceUsdCents)}
              </span>
            </a>
          )}
          {account && (
            <span className="px-3 py-1.5 text-muted">{account.name}</span>
          )}
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-muted hover:text-white hover:bg-surface transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
