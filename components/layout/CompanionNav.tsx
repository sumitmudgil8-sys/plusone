'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/companion/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/companion/bookings', label: 'Bookings', icon: CalendarIcon },
  { href: '/companion/inbox', label: 'Inbox', icon: ChatIcon },
  { href: '/companion/earnings', label: 'Earnings', icon: CurrencyIcon },
  { href: '/companion/profile', label: 'Profile', icon: UserIcon },
];

export function CompanionNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/[0.06] md:relative md:top-0 md:border-t-0 md:border-b md:bg-charcoal-surface md:backdrop-blur-none z-50 safe-area-bottom">
      <div className="max-w-7xl mx-auto md:px-4">
        <ul className="flex items-stretch justify-around md:justify-start md:gap-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:py-3 md:pb-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="flex-1 md:flex-none">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    'relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-0.5 md:gap-2 min-h-[56px] py-2 md:px-4 md:py-2 rounded-xl transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
                    isActive
                      ? 'text-amber-400'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
                  )}
                >
                  <item.icon className={cn(
                    'w-6 h-6 md:w-5 md:h-5 transition-transform duration-200',
                    isActive && 'scale-110'
                  )} />
                  <span className="text-[10px] md:text-sm font-semibold tracking-wide">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0.5 md:hidden w-6 h-0.5 bg-amber-400 rounded-full" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
