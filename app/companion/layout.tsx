"use client";
import { CompanionNav } from '@/components/layout/CompanionNav';

export default function CompanionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      <header className="bg-charcoal-surface border-b border-charcoal-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-bold text-gold">Plus One</h1>
            <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">Companion</span>
          </div>
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

      <CompanionNav />
    </div>
  );
}
