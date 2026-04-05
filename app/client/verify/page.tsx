'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function VerifyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [okycStatus, setOkycStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Check current OKYC status on load
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/auth/okyc/status');
        if (res.ok) {
          const data = await res.json();
          setOkycStatus(data.data?.status ?? null);
        }
      } catch {
        // non-fatal
      } finally {
        setChecking(false);
      }
    };
    check();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/okyc/initiate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to start verification');
        return;
      }
      // Redirect to Setu OKYC page
      window.location.href = data.data.okycUrl;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isVerified = okycStatus === 'SUCCESS';

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
          <p className="text-white/60 mt-1 text-sm">
            Verify your identity using Aadhaar OTP
          </p>
        </div>

        {checking ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <Card className="space-y-6">
            {/* Status banner */}
            {isVerified && (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-400 text-sm font-medium">
                  Identity verified. Waiting for admin approval.
                </p>
              </div>
            )}

            {okycStatus === 'FAILED' && (
              <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-lg p-4">
                <svg className="w-5 h-5 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-error text-sm">
                  Verification failed. Please try again.
                </p>
              </div>
            )}

            {/* Explainer */}
            <div className="space-y-3">
              <h3 className="font-medium text-white">What is Aadhaar OTP verification?</h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-gold shrink-0">•</span>
                  <span>We use Setu OKYC — a government-certified method to verify your identity using your Aadhaar number.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold shrink-0">•</span>
                  <span>You will receive an OTP on your Aadhaar-linked mobile number.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold shrink-0">•</span>
                  <span>No documents are uploaded — only a masked confirmation is stored.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold shrink-0">•</span>
                  <span>The process takes about 2 minutes.</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleVerify}
              isLoading={loading}
              className="w-full"
              disabled={isVerified}
            >
              {isVerified ? 'Verification Complete' : 'Verify with Aadhaar OTP'}
            </Button>

            <p className="text-xs text-white/30 text-center">
              Your Aadhaar data is processed by Setu (NPCI-certified) and is not stored on our servers.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
