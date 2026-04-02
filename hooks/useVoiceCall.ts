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
  error: string | null;
  toggleMute: () => Promise<void>;
  endCall: () => Promise<void>;
}

/**
 * Manages an Agora voice call for a billing session.
 * Pass `sessionId` to start — set to null to skip (e.g. not yet started).
 *
 * Usage:
 *   const call = useVoiceCall(sessionId, userId);
 *   // tick billing separately with setInterval → POST /api/billing/tick
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
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(async () => {
    try {
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (err) {
      console.error('Agora cleanup error:', err);
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !userId) return;

    let cancelled = false;

    async function joinCall() {
      setState('connecting');
      setError(null);

      try {
        // Fetch token from server
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

        // Dynamic import — agora-rtc-sdk-ng is browser-only
        const AgoraRTCModule = (await import('agora-rtc-sdk-ng')) as {
          default: typeof AgoraRTC;
        };
        const AgoraRTCClient = AgoraRTCModule.default;

        if (cancelled) return;

        const agoraClient = AgoraRTCClient.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = agoraClient;

        // Remote user handlers
        agoraClient.on('user-published', async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            await agoraClient.subscribe(remoteUser, 'audio');
            remoteUser.audioTrack?.play();
            setRemoteUserJoined(true);
          }
        });

        agoraClient.on('user-unpublished', (_remoteUser: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            setRemoteUserJoined(false);
          }
        });

        agoraClient.on('user-left', () => {
          setRemoteUserJoined(false);
        });

        // Join the channel (string UID mode)
        await agoraClient.join(appId, channelName, token, uid);

        if (cancelled) {
          await cleanup();
          return;
        }

        // Create and publish local microphone track
        const micTrack = await AgoraRTCClient.createMicrophoneAudioTrack();
        localTrackRef.current = micTrack;

        if (cancelled) {
          await cleanup();
          return;
        }

        await agoraClient.publish(micTrack);
        setState('connected');
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Call failed';
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

  const toggleMute = useCallback(async () => {
    if (!localTrackRef.current) return;
    const next = !isMuted;
    await localTrackRef.current.setEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  const endCall = useCallback(async () => {
    setState('ended');
    await cleanup();
  }, [cleanup]);

  return { state, isMuted, remoteUserJoined, error, toggleMute, endCall };
}
