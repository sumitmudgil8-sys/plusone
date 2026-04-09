'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Persistent banner shown across the app when a voice call is active.
 * Stores call metadata in sessionStorage so it survives page navigation.
 *
 * To activate:   ActiveCallBanner.set({ sessionId, returnPath, peerName })
 * To deactivate: ActiveCallBanner.clear()
 */

const STORAGE_KEY = '_pone_active_call';

export interface ActiveCallMeta {
  sessionId: string;
  returnPath: string;  // URL to navigate back to the call page
  peerName: string;
}

/** Set active call metadata (call from call page on mount). */
function setActiveCall(meta: ActiveCallMeta) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    window.dispatchEvent(new Event('activecall'));
  } catch {}
}

/** Clear active call metadata (call when call ends). */
function clearActiveCall() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('activecall'));
  } catch {}
}

/** Read current active call (returns null if none). */
function getActiveCall(): ActiveCallMeta | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveCallMeta) : null;
  } catch {
    return null;
  }
}

export function ActiveCallBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [meta, setMeta] = useState<ActiveCallMeta | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Listen for changes to the active call state
  useEffect(() => {
    const update = () => setMeta(getActiveCall());
    update();
    window.addEventListener('activecall', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('activecall', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  // Tick elapsed time
  useEffect(() => {
    if (!meta) return;
    const start = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [meta?.sessionId]);

  // Hide the banner if we're already on the call page
  if (!meta || pathname === meta.returnPath) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <button
      onClick={() => router.push(meta.returnPath)}
      className="fixed top-0 left-0 right-0 z-[100] bg-green-600 hover:bg-green-500 transition-colors px-4 py-2 flex items-center justify-center gap-3 text-white text-sm font-medium shadow-lg"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      <span>In call with {meta.peerName}</span>
      <span className="font-mono">{timeStr}</span>
      <span className="text-white/70">· Tap to return</span>
    </button>
  );
}

// Static helpers for external use
ActiveCallBanner.set = setActiveCall;
ActiveCallBanner.clear = clearActiveCall;
ActiveCallBanner.get = getActiveCall;
