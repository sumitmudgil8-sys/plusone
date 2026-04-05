'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';

export default function RejectedPage() {
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setReason(data.user?.rejectionReason ?? null);
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-gold mb-2">Plus One</h1>
        </div>

        <Card className="space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Application Not Approved</h2>
            <p className="text-white/60 text-sm">
              We reviewed your application and are unable to approve it at this time.
            </p>
          </div>

          {!loading && reason && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">
                Reason provided
              </p>
              <p className="text-white/80 text-sm">{reason}</p>
            </div>
          )}

          <div className="border-t border-charcoal-border pt-5 space-y-3 text-center">
            <p className="text-white/60 text-sm">
              If you believe this is an error or would like to provide additional
              information, please contact our support team.
            </p>
            <a
              href="mailto:support@plusone.app"
              className="inline-block text-gold hover:underline text-sm"
            >
              support@plusone.app
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
