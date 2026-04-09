'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/payments', label: 'Payments', icon: PaymentIcon },
  { href: '/admin/chats', label: 'Chats', icon: ChatIcon },
  { href: '/admin/withdrawals', label: 'Payouts', icon: WalletIcon },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/withdrawals?status=PENDING')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPendingCount(d.data.withdrawals.length);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('_pone_rt');
    sessionStorage.removeItem('_session_ok');
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* proceed */ }
    window.location.href = '/login?logged_out=1';
  };

  const isActive = (href: string) => {
    if (href === '/admin/users') {
      return pathname === '/admin/users' ||
        pathname.startsWith('/admin/users/') ||
        pathname === '/admin/clients' ||
        pathname.startsWith('/admin/clients/') ||
        pathname === '/admin/companions' ||
        pathname.startsWith('/admin/companions/');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 glass-strong border-b border-white/[0.06] z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
                <span className="text-sm font-black text-charcoal">P1</span>
              </div>
              <div>
                <span className="text-base font-bold text-white">Plus One</span>
                <span className="ml-2 text-[10px] uppercase tracking-widest bg-gold/15 text-gold px-2 py-0.5 rounded-full font-semibold">
                  Admin
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/[0.06] z-50 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <ul className="flex items-center justify-around px-2 py-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const badge = item.href === '/admin/withdrawals' && pendingCount > 0 ? pendingCount : null;
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-200',
                      active
                        ? 'text-gold'
                        : 'text-white/40 hover:text-white/70'
                    )}
                  >
                    {active && (
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-gold rounded-full" />
                    )}
                    <span className={cn(
                      'relative transition-transform duration-200',
                      active && 'scale-110'
                    )}>
                      <item.icon className="w-5 h-5" />
                      {badge !== null && (
                        <span className="absolute -top-1.5 -right-2.5 text-[9px] bg-amber-500 text-black font-bold min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full leading-none">
                          {badge}
                        </span>
                      )}
                    </span>
                    <span className={cn(
                      'text-[10px] font-medium transition-all',
                      active ? 'text-gold' : 'text-white/40'
                    )}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function PaymentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
