"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CompanionNav } from '@/components/layout/CompanionNav';
import { useSocket } from '@/hooks/useSocket';
import { PushPermissionPrompt } from '@/components/PushPermissionPrompt';
import { ActiveCallBanner } from '@/components/ActiveCallBanner';
import { CompanionCallProvider, useCompanionCall } from '@/contexts/CompanionCallContext';

interface IncomingCall {
  sessionId: string;
  clientId: string;
  callerName: string;
  callerAvatar: string | null;
  channelName: string;
  ratePerMinute: number;
}

interface IncomingChatRequest {
  requestId?: string;    // old ChatRequest flow
  sessionId?: string;    // new BillingSession flow
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  ratePerMinute?: number;
  expiresAt?: string;    // ISO timestamp
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
          <p className="text-sm text-white/50 mt-1">
            Voice call{call.ratePerMinute ? ` · ₹${Math.round(call.ratePerMinute * 0.4 / 100)}/min` : ''}
          </p>
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

// ─── Incoming chat request modal ─────────────────────────────────────────────
function IncomingChatRequestModal({
  request,
  onAccept,
  onDecline,
}: {
  request: IncomingChatRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!request.expiresAt) return 180;
    return Math.max(0, Math.floor((new Date(request.expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!request.expiresAt) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); onDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [request.expiresAt, onDecline]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 bg-[#1C1C1C] border border-[#3A3A3A] rounded-2xl p-8 shadow-2xl text-center space-y-5">
        {request.clientAvatar ? (
          <img src={request.clientAvatar} alt={request.clientName}
            className="w-20 h-20 rounded-full mx-auto object-cover ring-4 ring-yellow-400/30" />
        ) : (
          <div className="w-20 h-20 rounded-full mx-auto bg-yellow-400/20 flex items-center justify-center ring-4 ring-yellow-400/30">
            <span className="text-2xl text-yellow-400 font-semibold">{request.clientName[0]}</span>
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-white">{request.clientName}</p>
          <p className="text-sm text-white/50 mt-1">
            Chat request{request.ratePerMinute ? ` · ₹${Math.round(request.ratePerMinute * 0.4 / 100)}/min` : ''}
          </p>
          {request.expiresAt && (
            <p className="text-xs text-white/40 mt-1">
              Expires in {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
          )}
        </div>
        {request.expiresAt && (
          <div className="w-full bg-[#3A3A3A] rounded-full h-1">
            <div
              className="bg-yellow-400 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (timeLeft / 180) * 100)}%` }}
            />
          </div>
        )}
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

// ─── Floating call widget ────────────────────────────────────────────────────
function CompanionFloatingCall({
  call,
  pathname,
  onReturn,
}: {
  call: ReturnType<typeof useCompanionCall>;
  pathname: string;
  onReturn: () => void;
}) {
  const { activeCall, voiceCall, liveSeconds, endCall } = call;
  if (!activeCall) return null;

  // If user is on the inbox page with this call's voiceSessionId, the full overlay is shown there
  const isOnCallPage = pathname.startsWith('/companion/inbox') && pathname.includes(activeCall.sessionId);
  if (isOnCallPage) return null;

  const mins = Math.floor(liveSeconds / 60);
  const secs = liveSeconds % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  const isConnected = voiceCall.state === 'connected';
  const statusText = voiceCall.state === 'connecting' ? 'Connecting…' :
    voiceCall.state === 'error' ? 'Call error' :
    !voiceCall.remoteUserJoined ? 'Waiting…' : 'In call';

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[90] bg-[#1a1a2e] border border-green-500/30 rounded-2xl shadow-2xl shadow-green-500/10 p-3 w-72">
      <div className="flex items-center gap-3">
        {activeCall.clientAvatar ? (
          <img src={activeCall.clientAvatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-green-500/30" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center ring-2 ring-green-500/30">
            <span className="text-sm font-semibold text-green-400">{activeCall.clientName[0]}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{activeCall.clientName}</p>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
            )}
            <span className="text-xs text-white/50">{statusText}</span>
            {isConnected && <span className="text-xs font-mono text-green-400">{timeStr}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={onReturn}
          className="flex-1 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors"
        >
          Return to call
        </button>
        <button
          onClick={() => voiceCall.toggleMute()}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            voiceCall.isMuted ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          {voiceCall.isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={endCall}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
        >
          End
        </button>
      </div>
    </div>
  );
}

// ─── Layout (outer wrapper — provides call context) ─────────────────────────
export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  return (
    <CompanionCallProvider userId={userId}>
      <CompanionLayoutInner userId={userId} setUserId={setUserId}>
        {children}
      </CompanionLayoutInner>
    </CompanionCallProvider>
  );
}

// ─── Layout inner (uses call context) ────────────────────────────────────────
function CompanionLayoutInner({ children, userId, setUserId }: {
  children: React.ReactNode;
  userId: string | undefined;
  setUserId: (id: string | undefined) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const companionCall = useCompanionCall();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [incomingChatRequest, setIncomingChatRequest] = useState<IncomingChatRequest | null>(null);

  // Fetch password state for the current user
  useEffect(() => {
    if (!userId) return;
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.id) {
          setNeedsPasswordChange(d.user.isTemporaryPassword === true);
        }
      })
      .catch(() => {});
  }, [userId]);

  // Extend the auth cookie once per app open (sliding 1-year window)
  useEffect(() => {
    if (sessionStorage.getItem('_session_ok')) return;

    const restoreWithRefreshToken = () => {
      const rt = localStorage.getItem('_pone_rt');
      if (!rt) return;
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.refreshToken) {
            localStorage.setItem('_pone_rt', d.refreshToken);
            sessionStorage.setItem('_session_ok', '1');
          }
        })
        .catch(() => {});
    };

    fetch('/api/session')
      .then((r) => {
        if (!r.ok) { restoreWithRefreshToken(); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.refreshToken) {
          localStorage.setItem('_pone_rt', d.refreshToken);
          sessionStorage.setItem('_session_ok', '1');
        }
      })
      .catch(() => { restoreWithRefreshToken(); });
  }, []);

  const { onIncomingCall, onIncomingChatRequest } = useSocket(userId, 'COMPANION');

  useEffect(() => {
    const unsubscribe = onIncomingCall((data) => setIncomingCall(data));
    return unsubscribe;
  }, [onIncomingCall]);

  useEffect(() => {
    const unsubscribe = onIncomingChatRequest((data) => setIncomingChatRequest(data));
    return unsubscribe;
  }, [onIncomingChatRequest]);

  // Poll for pending chat requests — catches requests that arrived while offline
  // or when Ably/push missed delivery. Starts immediately on mount (no userId
  // dependency — both endpoints authenticate via session cookie).
  useEffect(() => {
    const fetchPending = async () => {
      try {
        // First check new BillingSession PENDING (returns both CHAT and VOICE)
        const billingRes = await fetch('/api/billing/pending');
        const billingData = await billingRes.json();
        if (billingData.success && billingData.data) {
          const d = billingData.data;
          if (d.type === 'VOICE') {
            // Route VOICE pending sessions to the incoming call modal
            setIncomingCall((prev) =>
              prev ? prev : {
                sessionId: d.sessionId,
                clientId: d.clientId,
                callerName: d.clientName,
                callerAvatar: d.clientAvatar,
                channelName: d.channelName,
                ratePerMinute: d.ratePerMinute,
              }
            );
          } else {
            // CHAT pending sessions go to the chat request modal
            setIncomingChatRequest((prev) =>
              prev ? prev : d
            );
          }
          return;
        }
        // Fall back to old ChatRequest model
        const res = await fetch('/api/chat-request/pending');
        const data = await res.json();
        if (data.success && data.data) {
          setIncomingChatRequest((prev) =>
            prev ? prev : data.data
          );
        }
      } catch {
        // Non-fatal
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handlePasswordChangeSuccess = useCallback(() => {
    setNeedsPasswordChange(false);
  }, []);

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { clientId, sessionId, callerName, callerAvatar } = incomingCall;
    setIncomingCall(null);
    try {
      await fetch('/api/billing/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* non-fatal */ }
    // Start call in context (Agora connects at layout level, persists across pages)
    companionCall.startCall({
      sessionId,
      clientId,
      clientName: callerName,
      clientAvatar: callerAvatar,
    });
    router.push(`/companion/inbox?active=${clientId}&voiceSessionId=${sessionId}`);
  }, [incomingCall, router, companionCall]);

  const handleDeclineCall = useCallback(async () => {
    if (!incomingCall) return;
    const { sessionId } = incomingCall;
    setIncomingCall(null);
    try {
      await fetch('/api/billing/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* non-fatal */ }
  }, [incomingCall]);

  const handleAcceptChatRequest = useCallback(async () => {
    if (!incomingChatRequest) return;
    const { requestId, sessionId, clientId } = incomingChatRequest;
    setIncomingChatRequest(null);
    // Complete the accept API call FIRST so the session is ACTIVE in DB
    // before the companion chat page loads and polls /api/companion/active-session.
    try {
      if (sessionId) {
        await fetch('/api/billing/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } else if (requestId) {
        await fetch(`/api/chat-request/${requestId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ACCEPTED' }),
        });
      }
    } catch {
      // Non-fatal — chat page will retry via polling
    }
    router.push(`/companion/inbox?active=${clientId}`);
  }, [incomingChatRequest, router]);

  const handleDeclineChatRequest = useCallback(async () => {
    if (!incomingChatRequest) return;
    const { requestId, sessionId } = incomingChatRequest;
    setIncomingChatRequest(null);
    try {
      if (sessionId) {
        // New BillingSession flow
        await fetch('/api/billing/decline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } else if (requestId) {
        // Old ChatRequest flow
        await fetch(`/api/chat-request/${requestId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DECLINED' }),
        });
      }
    } catch {
      // Non-fatal
    }
  }, [incomingChatRequest]);

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
              localStorage.removeItem('_pone_rt');
              sessionStorage.removeItem('_session_ok');
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
      <PushPermissionPrompt />

      {/* Floating call widget — visible on all pages when a call is active */}
      {companionCall.activeCall && companionCall.voiceCall.state !== 'ended' && (
        <CompanionFloatingCall
          call={companionCall}
          pathname={pathname}
          onReturn={() => router.push(`/companion/inbox?active=${companionCall.activeCall!.clientId}&voiceSessionId=${companionCall.activeCall!.sessionId}`)}
        />
      )}

      {incomingCall && !needsPasswordChange && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {incomingChatRequest && !needsPasswordChange && !incomingCall && (
        <IncomingChatRequestModal
          request={incomingChatRequest}
          onAccept={handleAcceptChatRequest}
          onDecline={handleDeclineChatRequest}
        />
      )}
    </div>
  );
}
