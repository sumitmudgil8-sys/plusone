'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function PendingPage() {
  const router = useRouter();
  const [okycStatus, setOkycStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      // Check OKYC status
      const okycRes = await fetch('/api/auth/okyc/status');
      if (okycRes.ok) {
        const data = await okycRes.json();
        setOkycStatus(data.data?.status ?? 'NOT_STARTED');
      }
      // Check overall approval status — route when APPROVED/REJECTED
      const meRes = await fetch('/api/users/me', { cache: 'no-store' });
      if (meRes.ok) {
        const me = await meRes.json();
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
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Auto-poll every 30 seconds — catches approval without forcing refresh
    const interval = setInterval(() => checkStatus(), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const okycComplete = okycStatus === 'SUCCESS';

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
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
              Our team is reviewing your application. You&apos;ll receive an email
              once a decision has been made — typically within{' '}
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
              {refreshing ? 'Checking…' : 'Check status'}
            </button>
          </div>

          {/* Identity verification section */}
          <div className="border-t border-charcoal-border pt-5">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
              Identity Verification
            </p>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-gold border-t-transparent rounded-full" />
              </div>
            ) : okycComplete ? (
              <div className="flex items-center gap-3 bg-success/10 border border-success/20 rounded-lg p-3">
                <svg className="w-5 h-5 text-success-fg shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-success-fg text-sm">Aadhaar identity verified</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gold/5 border border-gold/20 rounded-lg p-3">
                  <svg className="w-5 h-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-white/70 text-sm">
                    Identity verification pending — complete this to speed up your review.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/client/verify')}
                  className="w-full"
                >
                  Complete Identity Verification
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-white/30 text-center">
            Questions? Email us at{' '}
            <a href="mailto:support@plusone.app" className="text-gold hover:underline">
              support@plusone.app
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
