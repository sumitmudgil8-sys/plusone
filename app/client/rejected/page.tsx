'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function RejectedPage() {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealSent, setAppealSent] = useState(false);
  const [appealNotes, setAppealNotes] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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
    fetchData();
  }, []);

  const handleAppeal = async () => {
    if (!appealNotes.trim() || appealNotes.trim().length < 20) {
      toast.error('Please provide more details (at least 20 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/client/govt-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalNotes: `[APPEAL] ${appealNotes.trim()}` }),
      });

      if (res.ok) {
        setAppealSent(true);
        setShowAppealForm(false);
        toast.success('Appeal submitted. Our team will review it.');
      } else {
        toast.error('Failed to submit appeal. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

          {/* What you can do */}
          <div className="border-t border-charcoal-border pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">What you can do</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-gold text-xs font-bold">1</span>
                </div>
                <p className="text-sm text-white/60">
                  Review the rejection reason above and ensure your documents are clear and valid.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-gold text-xs font-bold">2</span>
                </div>
                <p className="text-sm text-white/60">
                  Submit an appeal with additional context or corrected information.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-gold text-xs font-bold">3</span>
                </div>
                <p className="text-sm text-white/60">
                  Contact our support team directly for assistance.
                </p>
              </div>
            </div>
          </div>

          {/* Appeal form */}
          {!appealSent && (
            <div className="border-t border-charcoal-border pt-5 space-y-3">
              {showAppealForm ? (
                <>
                  <label className="block text-sm font-medium text-white/80">
                    Why should we reconsider?
                  </label>
                  <textarea
                    value={appealNotes}
                    onChange={(e) => setAppealNotes(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Explain what may have gone wrong, provide additional context, or mention any corrections you've made..."
                    className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                  />
                  {appealNotes.length > 0 && (
                    <p className="text-xs text-white/30 text-right">{appealNotes.length}/1000</p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { setShowAppealForm(false); setAppealNotes(''); }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAppeal}
                      isLoading={submitting}
                      disabled={appealNotes.trim().length < 20}
                      className="flex-1"
                    >
                      Submit Appeal
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowAppealForm(true)}
                  className="w-full"
                >
                  Appeal this decision
                </Button>
              )}
            </div>
          )}

          {/* Appeal success */}
          {appealSent && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 text-sm">Appeal submitted. Our team will review it and get back to you.</p>
            </div>
          )}

          {/* Support contact */}
          <div className="border-t border-charcoal-border pt-5 text-center space-y-2">
            <p className="text-white/50 text-sm">
              Need help? Contact our support team.
            </p>
            <a
              href="mailto:support@plusone.app"
              className="inline-flex items-center gap-2 text-gold hover:underline text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              support@plusone.app
            </a>
            <div className="pt-2">
              <Link href="/faq" className="text-xs text-white/30 hover:text-gold transition-colors">
                View FAQ
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
