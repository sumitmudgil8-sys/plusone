'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import type { VoiceCallState } from '@/hooks/useVoiceCall';
import { ActiveCallBanner } from '@/components/ActiveCallBanner';
import { useEffect, useRef } from 'react';

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
  startCall: (info: CallInfo) => void;
  endCall: () => Promise<void>;
}

const CompanionCallContext = createContext<CompanionCallContextValue | null>(null);

export function useCompanionCall() {
  const ctx = useContext(CompanionCallContext);
  if (!ctx) throw new Error('useCompanionCall must be used inside CompanionCallProvider');
  return ctx;
}

export function CompanionCallProvider({ children, userId }: { children: ReactNode; userId: string | undefined }) {
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);

  // The Agora hook — connected to activeCall.sessionId
  const voiceSessionId = activeCall?.sessionId ?? null;
  const voiceCall = useVoiceCall(voiceSessionId, userId ?? '');

  // Live seconds timer
  const [liveSeconds, setLiveSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (voiceCall.state === 'connected') {
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
  }, [voiceCall.state]);

  // Sync ActiveCallBanner
  useEffect(() => {
    if (activeCall && voiceCall.state === 'connected') {
      ActiveCallBanner.set({
        sessionId: activeCall.sessionId,
        returnPath: `/companion/inbox?active=${activeCall.clientId}&voiceSessionId=${activeCall.sessionId}`,
        peerName: activeCall.clientName,
      });
    }
    if (voiceCall.state === 'ended' || voiceCall.state === 'error') {
      ActiveCallBanner.clear();
    }
  }, [activeCall, voiceCall.state]);

  // Auto-clear activeCall when call ends
  useEffect(() => {
    if (voiceCall.state === 'ended' || voiceCall.state === 'error') {
      // Small delay so UI can show "Call ended" before clearing
      const t = setTimeout(() => setActiveCall(null), 2000);
      return () => clearTimeout(t);
    }
  }, [voiceCall.state]);

  const startCall = useCallback((info: CallInfo) => {
    setActiveCall(info);
    setLiveSeconds(0);
    startedAtRef.current = null;
  }, []);

  const endCallHandler = useCallback(async () => {
    ActiveCallBanner.clear();
    await voiceCall.endCall();
    if (activeCall?.sessionId) {
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeCall.sessionId }),
      }).catch(() => {});
    }
    setActiveCall(null);
    setLiveSeconds(0);
    startedAtRef.current = null;
  }, [voiceCall, activeCall?.sessionId]);

  return (
    <CompanionCallContext.Provider value={{ activeCall, voiceCall, liveSeconds, startCall, endCall: endCallHandler }}>
      {children}
    </CompanionCallContext.Provider>
  );
}
