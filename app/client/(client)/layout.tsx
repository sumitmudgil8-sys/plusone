"use client";
import { ClientNav } from '@/components/layout/ClientNav';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      <header className="bg-charcoal-surface border-b border-charcoal-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-gold">Plus One</h1>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm text-white/60 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 pb-24 md:pb-0">
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>

      <ClientNav />
    </div>
  );
}
