"use client";
import { useEffect } from 'react';
import Link from 'next/link';
import { ClientNav } from '@/components/layout/ClientNav';
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { ActiveCallBanner } from '@/components/ActiveCallBanner';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Extend the auth cookie once per app open (sliding 30-day window).
  // sessionStorage is cleared when the app is fully closed, so this runs
  // on every fresh open but not on every page navigation within a session.
  useEffect(() => {
    if (sessionStorage.getItem('_session_ok')) return;
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => {
        if (d.refreshToken) {
          localStorage.setItem('_pone_rt', d.refreshToken);
          sessionStorage.setItem('_session_ok', '1');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('_pone_rt');
    sessionStorage.removeItem('_session_ok');
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col">
      <header className="bg-[#0B0B0B] border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-serif font-bold text-[#C9A96E]">Plus One</h1>
          <div className="flex items-center gap-3">
            <Link href="/client/wallet" className="text-white/50 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h5.25A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6" />
              </svg>
            </Link>
            <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
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
      <PushPermissionPrompt />
      <ActiveCallBanner />
    </div>
  );
}
