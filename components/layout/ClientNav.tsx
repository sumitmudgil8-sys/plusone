'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navItems = [
  { href: '/client/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/client/inbox', label: 'Chats', icon: ChatIcon },
  { href: '/client/bookings', label: 'Bookings', icon: CalendarIcon },
  { href: '/client/profile', label: 'Profile', icon: UserIcon },
];

export function ClientNav() {
  const pathname = usePathname();

  // Hide nav on full-screen chat page — it would overlap the input bar
  const isFullScreenChat = /^\/client\/inbox\/.+/.test(pathname);
  if (isFullScreenChat) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-charcoal-surface border-t border-charcoal-border md:relative md:top-0 md:border-t-0 md:border-b z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <ul className="flex justify-around md:justify-start md:gap-8 py-2 md:py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-lg transition-colors',
                      isActive
                        ? 'text-gold'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', isActive && 'fill-current')} />
                    <span className="text-xs md:text-sm font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Notification Bell - Desktop only */}
          <div className="hidden md:block">
            <NotificationBell />
          </div>
        </div>
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
