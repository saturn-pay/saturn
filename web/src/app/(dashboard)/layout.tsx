'use client';

import { AuthGuard } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Nav />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8 max-w-[1000px]">{children}</main>
      </div>
    </AuthGuard>
  );
}
