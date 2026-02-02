'use client';

import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/agents', label: 'Agents' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/audit-logs', label: 'Audit Logs' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-border min-h-[calc(100vh-56px)]">
      <nav className="py-4">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`block px-6 py-2 text-sm transition-colors ${
                active
                  ? 'text-black font-semibold bg-surface'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
