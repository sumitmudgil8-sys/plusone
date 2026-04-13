'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export default function PendingPage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      if (res.ok) {
        const me = await res.json();
        const clientStatus = me.user?.clientStatus;
        if (clientStatus === 'APPROVED') {
          router.replace('/client/dashboard');
          return;
        }
        if (clientStatus === 'REJECTED') {
          router.replace('/client/rejected');
          return;
        }
      }
    } catch {
      // non-fatal
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => checkStatus(), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-gold mb-2">Plus One</h1>
        </div>

        <Card className="space-y-6">
          {/* Status */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Application Under Review</h2>
            <p className="text-white/60 text-sm">
              Our team is reviewing your application and verifying your ID.
              You&apos;ll receive an update once a decision has been made — typically within{' '}
              <strong className="text-white">24–48 hours</strong>.
            </p>
            <button
              onClick={() => checkStatus(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs text-gold hover:text-gold/80 transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Checking...' : 'Check status'}
            </button>
          </div>

          {/* Progress */}
          <div className="border-t border-charcoal-border pt-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-white/70">Account created</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-white/70">Government ID uploaded</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              </div>
              <span className="text-sm text-gold">Admin review in progress</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-2">
            <p className="text-xs text-white/30">
              Questions? Check our{' '}
              <Link href="/faq" className="text-gold hover:underline">
                FAQ
              </Link>
              {' '}or email{' '}
              <a href="mailto:support@plusone.app" className="text-gold hover:underline">
                support@plusone.app
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
