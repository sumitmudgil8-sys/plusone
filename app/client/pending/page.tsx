'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const COMPANION_REVIEW_MS = 8 * 60 * 60 * 1000; // 8 hours

export default function PendingPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [infoRequest, setInfoRequest] = useState<string | null>(null);

  // Admin approval + 8-hour delay state
  const [adminApprovedAt, setAdminApprovedAt] = useState<string | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string>('NONE');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Response form state (for admin info requests)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Compute time remaining in the 8-hour window
  useEffect(() => {
    if (!adminApprovedAt || accessGranted) return;

    const update = () => {
      const elapsed = Date.now() - new Date(adminApprovedAt).getTime();
      const remaining = COMPANION_REVIEW_MS - elapsed;
      if (remaining <= 0) {
        setTimeRemaining('');
        return;
      }
      const h = Math.floor(remaining / (1000 * 60 * 60));
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(h > 0 ? `~${h}h ${m}m` : `~${m} min`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [adminApprovedAt, accessGranted]);

  const refreshSessionAndRedirect = async () => {
    setRedirecting(true);
    try {
      // Refresh the JWT so middleware allows access to /client/dashboard
      const rt = localStorage.getItem('_pone_rt');
      if (rt) {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
      }
      router.replace('/client/dashboard');
    } catch {
      setRedirecting(false);
      toast.error('Failed to redirect. Please try refreshing the page.');
    }
  };

  const checkStatus = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const me = data.user;
        const clientStatus = me?.clientStatus;

        // Update avatar state
        if (me?.clientProfile) {
          setAvatarUrl(me.clientProfile.avatarUrl || null);
          setAvatarStatus(me.clientProfile.avatarStatus || 'NONE');
        }

        if (clientStatus === 'REJECTED') {
          router.replace('/client/rejected');
          return;
        }

        if (clientStatus === 'APPROVED') {
          setAdminApprovedAt(me.adminApprovedAt);

          if (data.accessGranted) {
            // 8-hour window has passed — refresh JWT and redirect
            setAccessGranted(true);
            await refreshSessionAndRedirect();
            return;
          }
          // Still in companion review window — stay on this page
        }

        // Check for info request
        const reason = me?.rejectionReason;
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

  // ── Avatar upload ───────────────────────────────────────────────────────

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);

    uploadAvatar(selected);
  };

  const uploadAvatar = async (imageFile: File) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('type', 'avatar');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed');
        setAvatarPreview(null);
        return;
      }

      setAvatarUrl(data.data.url);
      setAvatarStatus('PENDING');
      toast.success('Profile picture uploaded! It will be reviewed by our team.');
    } catch {
      toast.error('Upload failed. Please try again.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Info request response (existing) ─────────────────────────────────

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

  if (redirecting) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Welcome to Plus One!</h2>
          <p className="text-white/60 text-sm">Your account has been approved. Redirecting...</p>
          <div className="animate-spin h-5 w-5 border-2 border-gold border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  const isAdminApproved = !!adminApprovedAt;
  const showAvatarUpload = !avatarUrl || avatarStatus === 'REJECTED';

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
            <h2 className="text-xl font-semibold text-white">
              {isAdminApproved ? 'Profile Under Final Review' : 'Application Under Review'}
            </h2>
            <p className="text-white/60 text-sm">
              {isAdminApproved ? (
                <>
                  Your identity has been verified. Your profile is now undergoing final review
                  {timeRemaining ? (
                    <> — estimated <strong className="text-white">{timeRemaining}</strong> remaining</>
                  ) : (
                    <> — this should complete shortly</>
                  )}.
                </>
              ) : (
                <>
                  Our team is reviewing your application.
                  You&apos;ll receive an update once a decision has been made — typically within{' '}
                  <strong className="text-white">24–48 hours</strong>.
                </>
              )}
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

          {/* ── Profile Picture Upload ────────────────────────────────── */}
          <div className="border-t border-charcoal-border pt-5 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Profile Picture
                {avatarStatus === 'PENDING' && (
                  <span className="text-xs font-normal text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    Under review
                  </span>
                )}
                {avatarStatus === 'APPROVED' && (
                  <span className="text-xs font-normal text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    Approved
                  </span>
                )}
              </h3>

              {avatarStatus === 'REJECTED' && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.068 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-xs text-red-300">
                    Your profile picture was rejected. Please upload a clear, real photo of yourself.
                  </p>
                </div>
              )}

              <p className="text-xs text-white/50">
                Upload your profile picture now to avoid delays later.
                Without a verified photo, you won&apos;t be able to interact with companions.
              </p>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
            />

            {/* Avatar preview / upload area */}
            {avatarUrl || avatarPreview ? (
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gold/30 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarPreview || avatarUrl || ''}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  {avatarStatus === 'PENDING' && (
                    <p className="text-xs text-blue-400">Your photo is being reviewed by our team.</p>
                  )}
                  {avatarStatus === 'APPROVED' && (
                    <p className="text-xs text-green-400">Photo approved.</p>
                  )}
                  {showAvatarUpload && (
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="text-xs text-gold hover:text-gold/80 transition-colors disabled:opacity-50"
                    >
                      {avatarStatus === 'REJECTED' ? 'Upload a new photo' : 'Change photo'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="w-full border border-dashed border-gold/20 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-gold/40 hover:bg-gold/[0.02] transition-colors disabled:opacity-50"
              >
                {avatarUploading ? (
                  <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                      <svg className="w-7 h-7 text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <span className="text-sm text-gold/80 font-medium">Upload Profile Picture</span>
                    <span className="text-xs text-white/40">JPG, PNG or WebP &middot; max 5MB</span>
                  </>
                )}
              </button>
            )}

            {/* Real photo warning */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.068 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-300">Real photos only</p>
                  <p className="text-xs text-amber-200/60 mt-0.5">
                    Your profile picture must be a clear, recent photo of yourself.
                    Using fake, AI-generated, celebrity, or misleading images will result in an{' '}
                    <strong className="text-amber-300">immediate and permanent account ban</strong>.
                  </p>
                </div>
              </div>
            </div>
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

          {/* Progress tracker (only show when no info request) */}
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
              {isAdminApproved ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-white/70">Identity verified</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    </div>
                    <span className="text-sm text-gold">Final profile review in progress</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  </div>
                  <span className="text-sm text-gold">Admin review in progress</span>
                </div>
              )}

              {/* Profile picture status in tracker */}
              {avatarUrl && avatarStatus !== 'NONE' && (
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    avatarStatus === 'APPROVED'
                      ? 'bg-green-500/20'
                      : avatarStatus === 'PENDING'
                        ? 'bg-blue-500/20'
                        : 'bg-red-500/20'
                  }`}>
                    {avatarStatus === 'APPROVED' ? (
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : avatarStatus === 'PENDING' ? (
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${
                    avatarStatus === 'APPROVED'
                      ? 'text-white/70'
                      : avatarStatus === 'PENDING'
                        ? 'text-blue-400'
                        : 'text-red-400'
                  }`}>
                    Profile picture {avatarStatus === 'APPROVED' ? 'approved' : avatarStatus === 'PENDING' ? 'under review' : 'rejected — please re-upload'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Browse companions early access */}
          {avatarStatus !== 'NONE' && !accessGranted && (
            <div className="border-t border-charcoal-border pt-5 space-y-3">
              <div className="flex items-start gap-3 bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-green-300">Start browsing while you wait</p>
                  <p className="text-xs text-white/50">
                    Your profile picture has been received. You can explore companions now — chat and booking unlock once your profile is approved.
                  </p>
                  <Link
                    href="/client/browse"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-400 hover:text-green-300 transition-colors"
                  >
                    Browse Companions
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
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
