import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Saturn Dashboard',
  description: 'Control plane for your Saturn agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-white min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
