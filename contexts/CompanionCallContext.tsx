'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { ActiveCallBanner } from '@/components/ActiveCallBanner';

interface CallInfo {
  sessionId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
}

interface CompanionCallContextValue {
  activeCall: CallInfo | null;
  voiceCall: ReturnType<typeof useVoiceCall>;
  liveSeconds: number;
  balanceLow: boolean;
  startCall: (info: CallInfo) => void;
  endCall: () => Promise<void>;
  setBalanceLow: (v: boolean) => void;
}

const CompanionCallContext = createContext<CompanionCallContextValue | null>(null);

export function useCompanionCall() {
  const ctx = useContext(CompanionCallContext);
  if (!ctx) throw new Error('useCompanionCall must be used inside CompanionCallProvider');
  return ctx;
}

export function CompanionCallProvider({ children, userId }: { children: ReactNode; userId: string | undefined }) {
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [balanceLow, setBalanceLow] = useState(false);

  const voiceSessionId = activeCall?.sessionId ?? null;
  const voiceCall = useVoiceCall(voiceSessionId, userId ?? '');

  // Refs for beforeunload access
  const activeCallRef = useRef<CallInfo | null>(null);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // Live seconds timer
  const [liveSeconds, setLiveSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer gates on BOTH state==='connected' AND remoteUserJoined so it only
  // runs once the other party is actually in the call. This matches the
  // client-side behaviour and honours the UX rule: "timer should start after
  // the other party enters". Before this fix the companion's timer started as
  // soon as their own Agora publish completed, even if the client hadn't
  // actually joined the channel yet.
  useEffect(() => {
    if (voiceCall.state === 'connected' && voiceCall.remoteUserJoined) {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      const tick = () => {
        if (!startedAtRef.current) return;
        setLiveSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (voiceCall.state === 'ended' || voiceCall.state === 'error') {
      if (timerRef.current) clearInterval(timerRef.current);
      startedAtRef.current = null;
      setLiveSeconds(0);
    }
  }, [voiceCall.state, voiceCall.remoteUserJoined]);

  // Sync ActiveCallBanner — only show once the remote party has joined, so
  // the mini-banner reflects an actual live call rather than a one-sided
  // Agora publish.
  useEffect(() => {
    if (activeCall && voiceCall.state === 'connected' && voiceCall.remoteUserJoined) {
      ActiveCallBanner.set({
        sessionId: activeCall.sessionId,
        returnPath: `/companion/inbox?active=${activeCall.clientId}&voiceSessionId=${activeCall.sessionId}`,
        peerName: activeCall.clientName,
      });
    }
    if (voiceCall.state === 'ended' || voiceCall.state === 'error') {
      ActiveCallBanner.clear();
    }
  }, [activeCall, voiceCall.state, voiceCall.remoteUserJoined]);

  // Auto-clear activeCall when call ends (30s fallback — companion normally
  // dismisses the post-call summary manually via "Done" button)
  useEffect(() => {
    if (voiceCall.state === 'ended' || voiceCall.state === 'error') {
      const t = setTimeout(() => setActiveCall(null), 30_000);
      return () => clearTimeout(t);
    }
  }, [voiceCall.state]);

  // ── beforeunload: end billing if companion closes browser during call ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      const call = activeCallRef.current;
      if (!call) return;
      const payload = JSON.stringify({ sessionId: call.sessionId });
      navigator.sendBeacon(
        '/api/billing/end',
        new Blob([payload], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const startCall = useCallback((info: CallInfo) => {
    setActiveCall(info);
    setLiveSeconds(0);
    setBalanceLow(false);
    startedAtRef.current = null;
  }, []);

  const endCallHandler = useCallback(async () => {
    // Capture sessionId before any async work — activeCall may be cleared
    // by the auto-clear timeout (2s after state → ended/error).
    const sid = activeCall?.sessionId;
    ActiveCallBanner.clear();
    await voiceCall.endCall();
    if (sid) {
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {});
    }
    setActiveCall(null);
    setLiveSeconds(0);
    startedAtRef.current = null;
  }, [voiceCall, activeCall?.sessionId]);

  return (
    <CompanionCallContext.Provider value={{ activeCall, voiceCall, liveSeconds, balanceLow, startCall, endCall: endCallHandler, setBalanceLow }}>
      {children}
    </CompanionCallContext.Provider>
  );
}
