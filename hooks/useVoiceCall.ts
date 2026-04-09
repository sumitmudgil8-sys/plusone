'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type AgoraRTC from 'agora-rtc-sdk-ng';
import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';

export type VoiceCallState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'error';

interface VoiceCallHook {
  state: VoiceCallState;
  isMuted: boolean;
  remoteUserJoined: boolean;
  remoteAudioPlaying: boolean;
  error: string | null;
  toggleMute: () => Promise<void>;
  endCall: () => Promise<void>;
}

/**
 * Manages an Agora voice call for a billing session.
 *
 * Edge cases handled:
 * - Tab switch / background: Agora keeps the connection alive; audio continues
 * - Network blip: Agora auto-reconnects; we track connection-state-change
 * - Remote user leaves: Fires user-left event; UI shows "disconnected"
 * - Browser close: beforeunload fires endCall to clean up
 * - Mute: Uses setMuted() which silences without unpublishing
 * - Token refresh: Not needed — Agora tokens last 1h, calls won't exceed that
 */
export function useVoiceCall(
  sessionId: string | null,
  userId: string
): VoiceCallHook {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  const [state, setState] = useState<VoiceCallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [remoteAudioPlaying, setRemoteAudioPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and beforeunload access
  const stateRef = useRef<VoiceCallState>('idle');
  const sessionIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const cleanup = useCallback(async () => {
    try {
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (err) {
      console.error('[useVoiceCall] cleanup error:', err);
    }
  }, []);

  // Main connection effect
  useEffect(() => {
    if (!sessionId || !userId) return;

    let cancelled = false;

    async function joinCall() {
      setState('connecting');
      setError(null);
      setRemoteUserJoined(false);
      setRemoteAudioPlaying(false);
      setIsMuted(false);

      try {
        const res = await fetch(`/api/agora/token?sessionId=${sessionId}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to get call token');
        }

        const { token, channelName, appId, uid } = json.data as {
          token: string;
          channelName: string;
          appId: string;
          uid: string;
        };

        if (cancelled) return;

        const AgoraRTCModule = (await import('agora-rtc-sdk-ng')) as {
          default: typeof AgoraRTC;
        };
        const AgoraRTCClient = AgoraRTCModule.default;

        if (cancelled) return;

        const agoraClient = AgoraRTCClient.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = agoraClient;

        // ── Remote user presence ────────────────────────────────────────
        agoraClient.on('user-joined', () => {
          console.log('[useVoiceCall] remote user joined');
          setRemoteUserJoined(true);
        });

        agoraClient.on('user-published', async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            await agoraClient.subscribe(remoteUser, 'audio');
            remoteUser.audioTrack?.play();
            setRemoteAudioPlaying(true);
            console.log('[useVoiceCall] remote audio subscribed + playing');
          }
        });

        agoraClient.on('user-unpublished', (_remoteUser: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            setRemoteAudioPlaying(false);
          }
        });

        agoraClient.on('user-left', () => {
          console.log('[useVoiceCall] remote user left');
          setRemoteUserJoined(false);
          setRemoteAudioPlaying(false);
        });

        // ── Connection state tracking ───────────────────────────────────
        // Agora auto-reconnects on network blips. We track state changes
        // to show "Reconnecting..." in the UI without breaking the call.
        agoraClient.on('connection-state-change', (curState, prevState, reason) => {
          console.log(`[useVoiceCall] connection: ${prevState} → ${curState}`, reason ?? '');

          if (curState === 'DISCONNECTED' && prevState === 'CONNECTED') {
            // Agora lost the connection. If it was a genuine disconnect
            // (not us calling leave()), it will auto-reconnect.
            // Only set error if the reason indicates a permanent failure.
            if (reason === 'LEAVE' || reason === 'UID_BANNED') {
              setState('ended');
            }
            // For NETWORK_ERROR / SERVER_ERROR, Agora retries automatically.
            // We don't set error — just let it reconnect.
          }

          if (curState === 'CONNECTED' && prevState === 'RECONNECTING') {
            console.log('[useVoiceCall] reconnected successfully');
            // Restore mute state after reconnection
            if (localTrackRef.current && isMutedRef.current) {
              localTrackRef.current.setMuted(true);
            }
          }
        });

        // ── Join channel ────────────────────────────────────────────────
        await agoraClient.join(appId, channelName, token, uid);

        if (cancelled) {
          await cleanup();
          return;
        }

        // ── Verify session is still active after Agora join ───────────
        // Handles race: companion declined while we were mid-join on Agora.
        // Re-request an Agora token — the endpoint returns 409 if session
        // is no longer ACTIVE (e.g. DECLINED, EXPIRED).
        try {
          const verifyRes = await fetch(`/api/agora/token?sessionId=${sessionId}`);
          if (!verifyRes.ok) {
            console.log('[useVoiceCall] session no longer active after Agora join, tearing down');
            setState('ended');
            await cleanup();
            return;
          }
        } catch {
          // Non-fatal — if we can't verify, continue with the call
        }

        if (cancelled) {
          await cleanup();
          return;
        }

        // ── Create and publish mic track ────────────────────────────────
        const micTrack = await AgoraRTCClient.createMicrophoneAudioTrack();
        localTrackRef.current = micTrack;

        if (cancelled) {
          await cleanup();
          return;
        }

        await agoraClient.publish(micTrack);
        setState('connected');
        console.log('[useVoiceCall] connected and publishing audio');
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Call failed';
          console.error('[useVoiceCall] join error:', message);
          setError(message);
          setState('error');
          await cleanup();
        }
      }
    }

    joinCall();

    return () => {
      cancelled = true;
      cleanup();
      setState('ended');
    };
  }, [sessionId, userId, cleanup]);

  // ── beforeunload: end billing if browser/tab is closed during call ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stateRef.current !== 'connected' && stateRef.current !== 'connecting') return;
      const sid = sessionIdRef.current;
      if (!sid) return;

      // Use sendBeacon — it's non-blocking and guaranteed to fire
      const payload = JSON.stringify({ sessionId: sid });
      navigator.sendBeacon(
        '/api/billing/end',
        new Blob([payload], { type: 'application/json' })
      );
      console.log('[useVoiceCall] beforeunload: sent billing end via beacon');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Tab visibility: re-play remote audio on return ──────────────────
  // Some mobile browsers pause audio playback when the tab is backgrounded.
  // On return, re-subscribe to remote users' audio tracks.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (stateRef.current !== 'connected' || !clientRef.current) return;

      // Re-play any remote users' audio that may have been paused
      const remoteUsers = clientRef.current.remoteUsers;
      for (const user of remoteUsers) {
        if (user.audioTrack && !user.audioTrack.isPlaying) {
          console.log('[useVoiceCall] re-playing remote audio after tab return');
          user.audioTrack.play();
          setRemoteAudioPlaying(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!localTrackRef.current) return;
    const next = !isMuted;
    localTrackRef.current.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const endCall = useCallback(async () => {
    setState('ended');
    await cleanup();
  }, [cleanup]);

  return { state, isMuted, remoteUserJoined, remoteAudioPlaying, error, toggleMute, endCall };
}
