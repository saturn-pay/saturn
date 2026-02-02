'use client';

import { useAuth } from '@/lib/auth';

export function Nav() {
  const { account, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between max-w-[1200px] mx-auto px-8 h-14">
        <a href="/" className="flex items-center gap-2 font-extrabold text-[15px] tracking-tight">
          <div className="w-5 h-5 rounded-full bg-black" />
          Saturn
        </a>
        <div className="flex items-center gap-4 text-sm">
          {account && (
            <span className="text-gray-500">{account.name}</span>
          )}
          <button
            onClick={logout}
            className="text-gray-500 hover:text-black transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
