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

      {/* Footer */}
      <footer className="hidden md:block border-t border-charcoal-border bg-charcoal-surface mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-white/30">
          <span>© {new Date().getFullYear()} Plus One. Pay per minute · No subscription.</span>
          <div className="flex gap-5">
            <a href="/terms" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="/refund-policy" className="hover:text-white/60 transition-colors">Refund Policy</a>
          </div>
        </div>
      </footer>

      <ClientNav />
    </div>
  );
}
