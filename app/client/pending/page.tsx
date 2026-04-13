'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function PendingPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [infoRequest, setInfoRequest] = useState<string | null>(null);

  // Response form state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
        // Check for info request
        const reason = me.user?.rejectionReason;
        if (reason && typeof reason === 'string' && reason.startsWith('[INFO REQUESTED]')) {
          setInfoRequest(reason.replace('[INFO REQUESTED] ', ''));
        } else {
          setInfoRequest(null);
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
    const interval = setInterval(() => checkStatus(), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      toast.error('Please upload a JPG, PNG, WebP, or PDF file');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    setFile(selected);
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleSubmitResponse = async () => {
    if (!file && !notes.trim()) {
      toast.error('Please upload a new ID or add notes');
      return;
    }

    setSubmitting(true);
    try {
      let govtIdUrl: string | undefined;

      // Upload new file if provided
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'document');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          toast.error(uploadData.error ?? 'Upload failed');
          return;
        }
        govtIdUrl = uploadData.data.url;
      }

      // Save to profile
      const saveRes = await fetch('/api/client/govt-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(govtIdUrl && { govtIdUrl }),
          ...(notes.trim() && { additionalNotes: notes.trim() }),
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        toast.error(saveData.error ?? 'Failed to submit');
        return;
      }

      setSubmitted(true);
      setInfoRequest(null);
      setFile(null);
      setPreview(null);
      setNotes('');
      toast.success('Response submitted — our team will review it shortly');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-8">
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

          {/* Admin info request */}
          {infoRequest && (
            <div className="border-t border-charcoal-border pt-5 space-y-4">
              <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gold shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gold">Additional information needed</p>
                    <p className="text-sm text-white/70 mt-1">{infoRequest}</p>
                  </div>
                </div>
              </div>

              {/* Re-upload ID */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">Upload new ID (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!file ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-white/15 rounded-lg p-4 flex items-center justify-center gap-2 hover:border-gold/30 hover:bg-gold/[0.02] transition-colors"
                  >
                    <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-white/40">Select a new ID photo</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {preview && (
                      <img src={preview} alt="ID preview" className="w-full max-h-32 object-contain rounded-lg border border-white/10 bg-black/30" />
                    )}
                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-2.5">
                      <span className="text-xs text-white/60 truncate">{file.name}</span>
                      <button
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="text-white/40 hover:text-white/70 text-xs shrink-0 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80">Additional notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Add any additional information or clarification..."
                  className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                />
                {notes.length > 0 && (
                  <p className="text-xs text-white/30 text-right">{notes.length}/1000</p>
                )}
              </div>

              <Button
                onClick={handleSubmitResponse}
                isLoading={submitting}
                disabled={!file && !notes.trim()}
                className="w-full"
              >
                Submit Response
              </Button>
            </div>
          )}

          {/* Success message after submitting response */}
          {submitted && !infoRequest && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 text-sm">Response submitted. Our team will review it shortly.</p>
            </div>
          )}

          {/* Progress (only show when no info request) */}
          {!infoRequest && (
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
          )}

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
