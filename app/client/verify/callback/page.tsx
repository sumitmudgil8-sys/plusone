'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function OkycCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [maskedAadhaar, setMaskedAadhaar] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/auth/okyc/status');
        const data = await res.json();
        if (res.ok && data.success) {
          setMaskedAadhaar(data.data?.maskedAadhaar ?? null);
          if (data.data?.status === 'SUCCESS') {
            setStatus('success');
          } else if (data.data?.status === 'FAILED') {
            setStatus('failed');
          } else {
            setStatus('pending');
          }
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-10 w-10 border-2 border-gold border-t-transparent rounded-full mx-auto" />
          <p className="text-white/60">Checking verification status…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="text-center space-y-6 py-8">
          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Identity Verified</h2>
                {maskedAadhaar && (
                  <p className="text-white/50 text-sm mt-1">Aadhaar: {maskedAadhaar}</p>
                )}
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                Your identity is confirmed. Our team will now review your application
                and email you once it&apos;s approved. This typically takes{' '}
                <strong className="text-white">24–48 hours</strong>.
              </p>
              <Button onClick={() => router.push('/client/pending')} className="w-full">
                Back to Application Status
              </Button>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Verification Failed</h2>
                <p className="text-white/60 text-sm mt-2">
                  The Aadhaar OTP verification was not completed successfully.
                </p>
              </div>
              <Button onClick={() => router.push('/client/verify')} className="w-full">
                Try Again
              </Button>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Verification Pending</h2>
                <p className="text-white/60 text-sm mt-2">
                  Your verification is still processing. Please check back shortly.
                </p>
              </div>
              <Button onClick={() => router.push('/client/verify')} variant="outline" className="w-full">
                Back to Verification
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
