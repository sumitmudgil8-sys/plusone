'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/client/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/client/inbox', label: 'Chats', icon: ChatIcon },
  { href: '/client/browse', label: 'Explore', icon: SearchIcon, center: true },
  { href: '/client/bookings', label: 'Bookings', icon: CalendarIcon },
  { href: '/client/profile', label: 'Profile', icon: UserIcon },
];

export function ClientNav() {
  const pathname = usePathname();

  // Hide nav on full-screen chat page — it would overlap the input bar
  const isFullScreenChat = /^\/client\/inbox\/.+/.test(pathname);
  if (isFullScreenChat) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B0B0B] border-t border-white/10 md:relative md:top-0 md:border-t-0 md:border-b safe-area-bottom">
      <div className="max-w-7xl mx-auto">
        <ul className="flex items-end justify-around py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:justify-start md:gap-6 md:px-4 md:py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isCenter = 'center' in item && item.center;

            if (isCenter) {
              return (
                <li key={item.href} className="flex flex-col items-center -mt-3 md:mt-0">
                  <Link
                    href={item.href}
                    className={cn(
                      'flex flex-col items-center gap-0.5 md:flex-row md:gap-2 md:px-3 md:py-2 md:rounded-lg transition-colors',
                    )}
                  >
                    <div className={cn(
                      'w-12 h-12 md:w-auto md:h-auto rounded-full flex items-center justify-center transition-colors',
                      isActive
                        ? 'bg-[#C9A96E] text-black'
                        : 'bg-white/10 text-white/70'
                    )}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      'text-[10px] md:text-sm font-medium mt-0.5 md:mt-0',
                      isActive ? 'text-[#C9A96E] md:text-[#C9A96E]' : 'text-white/50'
                    )}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-1 px-2 md:flex-row md:gap-2 md:px-3 md:py-2 md:rounded-lg transition-colors',
                    isActive
                      ? 'text-[#C9A96E]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive && 'fill-current')} />
                  <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
