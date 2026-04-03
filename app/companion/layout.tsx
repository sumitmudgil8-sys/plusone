"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionNav } from '@/components/layout/CompanionNav';
import { useSocket } from '@/hooks/useSocket';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface IncomingCall {
  sessionId: string;
  clientId: string;
  callerName: string;
  callerAvatar: string | null;
  channelName: string;
  ratePerMinute: number;
}

export default function CompanionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.id) setUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  const { onIncomingCall } = useSocket(userId, 'COMPANION');

  useEffect(() => {
    const unsubscribe = onIncomingCall((data) => {
      setIncomingCall(data);
    });
    return unsubscribe;
  }, [onIncomingCall]);

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    const { clientId, sessionId } = incomingCall;
    setIncomingCall(null);
    router.push(`/companion/inbox/${clientId}?voiceSessionId=${sessionId}`);
  };

  const handleDeclineCall = () => {
    setIncomingCall(null);
  };

  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
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

      {/* Incoming Voice Call Modal */}
      <Modal
        isOpen={!!incomingCall}
        onClose={handleDeclineCall}
        title="Incoming Call"
        showCloseButton={false}
        size="sm"
      >
        {incomingCall && (
          <div className="text-center space-y-5">
            <div>
              {incomingCall.callerAvatar ? (
                <img
                  src={incomingCall.callerAvatar}
                  alt={incomingCall.callerName}
                  className="w-20 h-20 rounded-full mx-auto object-cover ring-4 ring-gold/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full mx-auto bg-gold/20 flex items-center justify-center ring-4 ring-gold/30">
                  <span className="text-2xl text-gold font-semibold">
                    {incomingCall.callerName[0]}
                  </span>
                </div>
              )}
              <p className="mt-3 text-lg font-semibold text-white">{incomingCall.callerName}</p>
              <p className="text-sm text-white/50 mt-1">Voice call request</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDeclineCall}
                className="flex-1"
              >
                Decline
              </Button>
              <Button onClick={handleAcceptCall} className="flex-1">
                Accept
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
