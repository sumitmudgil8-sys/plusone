"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionNav } from '@/components/layout/CompanionNav';
import { useSocket } from '@/hooks/useSocket';

interface IncomingCall {
  sessionId: string;
  clientId: string;
  callerName: string;
  callerAvatar: string | null;
  channelName: string;
  ratePerMinute: number;
}

// ─── Force password-change modal ────────────────────────────────────────────
// Covers the entire viewport. No close button. No escape. Inert backdrop.
function ForcePasswordModal({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to update password');
        return;
      }
      onSuccess();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Fixed full-viewport overlay — pointer-events-none on nothing; everything beneath is blocked */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      // Prevent any click from reaching content underneath
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md mx-4 bg-[#1C1C1C] border border-[#3A3A3A] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Password Update Required</h2>
          <p className="text-sm text-white/50 mt-1">
            You must set a new password before accessing your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Current Password</label>
            <input
              name="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Enter your temporary password"
              required
              autoFocus
              className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
            <input
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="At least 8 characters"
              required
              className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm New Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat new password"
              required
              className="w-full bg-[#2A2A2A] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Incoming call modal ─────────────────────────────────────────────────────
function IncomingCallModal({
  call,
  onAccept,
  onDecline,
}: {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-[#1C1C1C] border border-[#3A3A3A] rounded-2xl p-8 shadow-2xl text-center space-y-5">
        {call.callerAvatar ? (
          <img src={call.callerAvatar} alt={call.callerName}
            className="w-20 h-20 rounded-full mx-auto object-cover ring-4 ring-yellow-400/30" />
        ) : (
          <div className="w-20 h-20 rounded-full mx-auto bg-yellow-400/20 flex items-center justify-center ring-4 ring-yellow-400/30">
            <span className="text-2xl text-yellow-400 font-semibold">{call.callerName[0]}</span>
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-white">{call.callerName}</p>
          <p className="text-sm text-white/50 mt-1">Voice call request</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onDecline}
            className="flex-1 py-2.5 rounded-lg border border-[#3A3A3A] text-white/70 hover:text-white hover:border-white/30 transition-colors">
            Decline
          </button>
          <button onClick={onAccept}
            className="flex-1 py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold transition-colors">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────
export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Fetch current user from DB (source of truth — not JWT)
  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.id) {
          setUserId(d.user.id);
          setNeedsPasswordChange(d.user.isTemporaryPassword === true);
        }
      })
      .catch(() => {});
  }, []);

  const { onIncomingCall } = useSocket(userId, 'COMPANION');

  useEffect(() => {
    const unsubscribe = onIncomingCall((data) => setIncomingCall(data));
    return unsubscribe;
  }, [onIncomingCall]);

  const handlePasswordChangeSuccess = useCallback(() => {
    setNeedsPasswordChange(false);
  }, []);

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    const { clientId, sessionId } = incomingCall;
    setIncomingCall(null);
    router.push(`/companion/inbox/${clientId}?voiceSessionId=${sessionId}`);
  }, [incomingCall, router]);

  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      {/* Blocking overlay — rendered before everything else so it sits on top */}
      {needsPasswordChange && (
        <ForcePasswordModal onSuccess={handlePasswordChangeSuccess} />
      )}

      <header className="bg-charcoal-surface border-b border-charcoal-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-bold text-gold">Plus One</h1>
            <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">Companion</span>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-sm text-white/60 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 pb-24 md:pb-0">
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>

      <CompanionNav />

      {incomingCall && !needsPasswordChange && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={() => setIncomingCall(null)}
        />
      )}
    </div>
  );
}
