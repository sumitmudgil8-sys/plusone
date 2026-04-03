'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { BILLING_TICK_SECONDS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

interface CurrentUser {
  id: string;
  email: string;
}

interface CompanionProfile {
  name: string;
  hourlyRate: number;
  avatarUrl: string | null;
}

interface Companion {
  id: string;
  name: string;
  avatarUrl: string | null;
  companionProfile: CompanionProfile | null;
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.129a1 1 0 00.502-1.21L7.228 3.683A1 1 0 006.279 3H5z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

export default function ChatPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [loading, setLoading] = useState(true);

  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [callStarting, setCallStarting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const call = useVoiceCall(voiceSessionId, user?.id ?? '');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        const companionRes = await fetch(`/api/companions/${companionId}`);
        if (companionRes.ok) {
          const companionData = await companionRes.json();
          setCompanion(companionData.companion);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companionId]);

  // Start billing tick + duration counter when call connects
  useEffect(() => {
    if (call.state === 'connected' && voiceSessionId) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      tickIntervalRef.current = setInterval(async () => {
        try {
          await fetch('/api/billing/tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: voiceSessionId }),
          });
        } catch {
          // tick failure is non-fatal; session will auto-expire via grace period
        }
      }, BILLING_TICK_SECONDS * 1000);

      return () => {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        tickIntervalRef.current = null;
        durationIntervalRef.current = null;
      };
    }
  }, [call.state, voiceSessionId]);

  // End billing session if call ends unexpectedly
  useEffect(() => {
    if (call.state === 'ended' && voiceSessionId) {
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: voiceSessionId }),
      }).catch(() => {});
      setVoiceSessionId(null);
      setCallDuration(0);
    }
  }, [call.state, voiceSessionId]);

  const handleStartCall = async () => {
    setCallStarting(true);
    setCallError(null);
    try {
      const res = await fetch('/api/billing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId, type: 'VOICE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCallError(data.error ?? 'Failed to start call');
        return;
      }
      setVoiceSessionId(data.data.session.id);
      setCallDuration(0);
    } catch {
      setCallError('Failed to start call');
    } finally {
      setCallStarting(false);
    }
  };

  const handleEndCall = useCallback(async () => {
    if (!voiceSessionId) return;
    await Promise.allSettled([
      fetch('/api/billing/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: voiceSessionId }),
      }),
      call.endCall(),
    ]);
    setVoiceSessionId(null);
    setCallDuration(0);
  }, [voiceSessionId, call]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !companion) {
    return (
      <Card className="text-center py-12">
        <p className="text-white/60">Unable to load chat</p>
        <Link href="/client/browse">
          <Button className="mt-4">Browse Companions</Button>
        </Link>
      </Card>
    );
  }

  const isInCall = call.state !== 'idle' && call.state !== 'ended';
  const ratePerMinute = Math.round((companion.companionProfile?.hourlyRate ?? 0) / 60);

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] relative">
      {/* Voice Call Overlay */}
      {isInCall && (
        <div className="absolute inset-0 z-10 bg-charcoal/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 rounded-xl">
          <div className="text-center">
            {companion.avatarUrl ? (
              <img
                src={companion.avatarUrl}
                alt={companion.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover ring-4 ring-gold/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gold/20 flex items-center justify-center ring-4 ring-gold/30">
                <span className="text-3xl text-gold font-semibold">{companion.name[0]}</span>
              </div>
            )}

            <h2 className="text-xl font-semibold text-white">{companion.name}</h2>

            <p className="text-white/60 mt-1 text-sm">
              {call.state === 'connecting' && 'Connecting...'}
              {call.state === 'connected' && (
                <>
                  {call.remoteUserJoined ? 'Connected' : 'Waiting for companion...'}
                  <span className="ml-2 font-mono text-gold">{formatDuration(callDuration)}</span>
                </>
              )}
              {call.state === 'error' && (
                <span className="text-red-400">{call.error}</span>
              )}
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <button
              onClick={call.toggleMute}
              title={call.isMuted ? 'Unmute' : 'Mute'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                call.isMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {call.isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
            </button>

            <button
              onClick={handleEndCall}
              title="End call"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
            >
              <PhoneOffIcon className="w-7 h-7" />
            </button>
          </div>

          {call.state === 'connected' && ratePerMinute > 0 && (
            <p className="text-xs text-white/40">
              Billed per minute · {formatCurrency(ratePerMinute)}/min
            </p>
          )}
        </div>
      )}

      <Card className="h-full flex flex-col overflow-hidden">
        {/* Header with call button */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-charcoal-border shrink-0">
          <span className="text-sm font-medium text-white">{companion.name}</span>
          <div className="flex items-center gap-2">
            {callError && (
              <span className="text-xs text-red-400 max-w-[160px] truncate">{callError}</span>
            )}
            <Button
              onClick={handleStartCall}
              isLoading={callStarting}
              disabled={isInCall}
              className="text-sm py-1.5 px-3 flex items-center gap-1.5"
            >
              <PhoneIcon className="w-4 h-4" />
              Call
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatWindow
            companionId={companionId}
            companionName={companion.name}
            companionAvatar={companion.avatarUrl ?? undefined}
            currentUserId={user.id}
            currentUserRole="CLIENT"
            isClient={true}
          />
        </div>
      </Card>
    </div>
  );
}
