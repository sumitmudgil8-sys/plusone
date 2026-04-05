'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function PendingPage() {
  const router = useRouter();
  const [okycStatus, setOkycStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/auth/okyc/status');
        if (res.ok) {
          const data = await res.json();
          setOkycStatus(data.data?.status ?? 'NOT_STARTED');
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    check();
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
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-400 text-sm">Aadhaar identity verified</p>
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
