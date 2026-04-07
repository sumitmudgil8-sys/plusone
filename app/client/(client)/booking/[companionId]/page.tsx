'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { CompanionProfile } from '@/components/companion/CompanionProfile';
import { ReviewSection } from '@/components/reviews/ReviewComponents';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSocket } from '@/hooks/useSocket';

const CHAT_REQUEST_TIMEOUT_S = 180; // 3 minutes

type ChatRequestStatus = 'idle' | 'sending' | 'waiting' | 'accepted' | 'declined' | 'expired' | 'insufficient_balance';

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const companionId = params.companionId as string;

  const [companion, setCompanion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const startTimeRef = useRef(Date.now());

  // Chat request state
  const [userId, setUserId] = useState<string | undefined>();
  const [chatRequestStatus, setChatRequestStatus] = useState<ChatRequestStatus>('idle');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatSessionIdRef = useRef<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHAT_REQUEST_TIMEOUT_S);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [insufficientBalanceDetails, setInsufficientBalanceDetails] = useState<{
    required: number;
    current: number;
    ratePerMinute: number;
  } | null>(null);

  // Fetch current user ID for Ably socket
  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (companionId) fetchCompanion();

    return () => {
      const durationMs = Date.now() - startTimeRef.current;
      if (durationMs > 2000) {
        navigator.sendBeacon(
          '/api/client/profile-view',
          new Blob(
            [JSON.stringify({ companionId, durationMs })],
            { type: 'application/json' }
          )
        );
      }
    };
  }, [companionId]);

  // Subscribe to chat accepted/declined events via Ably
  const { onChatRequestResponse } = useSocket(userId, 'CLIENT');

  // Keep ref in sync so the subscription doesn't need to re-register on sessionId changes
  useEffect(() => { chatSessionIdRef.current = chatSessionId; }, [chatSessionId]);

  useEffect(() => {
    if (!userId) return;
    return onChatRequestResponse((data) => {
      if (chatSessionIdRef.current && data.sessionId !== chatSessionIdRef.current) return;
      if (data.status === 'ACCEPTED') {
        setChatRequestStatus('accepted');
        setTimeout(() => router.push(`/client/inbox/${companionId}`), 800);
      } else {
        setChatRequestStatus('declined');
      }
    });
  }, [userId, onChatRequestResponse, companionId, router]);

  // Poll session-status while waiting — catches missed Ably chat:accepted events
  useEffect(() => {
    if (chatRequestStatus !== 'waiting' || !chatSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/session-status?companionId=${companionId}`);
        const d = await res.json();
        if (d.data?.status === 'ACTIVE') {
          clearInterval(interval);
          setChatRequestStatus('accepted');
          setTimeout(() => router.push(`/client/inbox/${companionId}`), 800);
        } else if (d.data?.status === 'EXPIRED' || d.data?.status === 'NONE') {
          clearInterval(interval);
          setChatRequestStatus('expired');
        }
      } catch { /* non-fatal */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [chatRequestStatus, chatSessionId, companionId, router]);

  // Countdown timer while waiting
  useEffect(() => {
    if (chatRequestStatus !== 'waiting') return;

    // Compute initial seconds from expiresAt if available
    const initial = expiresAt
      ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : CHAT_REQUEST_TIMEOUT_S;
    setTimeLeft(initial);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setChatRequestStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [chatRequestStatus, expiresAt]);

  const handleChatRequest = useCallback(async () => {
    setChatRequestStatus('sending');
    try {
      const res = await fetch('/api/billing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId, type: 'CHAT' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_BALANCE') {
          setInsufficientBalanceDetails({
            required: data.required,
            current: data.current,
            ratePerMinute: data.ratePerMinute,
          });
          setChatRequestStatus('insufficient_balance');
          return;
        }
        setChatRequestStatus('idle');
        return;
      }
      if (!data.success) {
        setChatRequestStatus('idle');
        return;
      }
      setChatSessionId(data.data.sessionId);
      setExpiresAt(data.data.expiresAt ?? null);
      // If already ACTIVE (resumed), go straight to inbox
      if (!data.data.pending) {
        router.push(`/client/inbox/${companionId}`);
        return;
      }
      setChatRequestStatus('waiting');
    } catch {
      setChatRequestStatus('idle');
    }
  }, [companionId, router]);

  const fetchCompanion = async () => {
    try {
      const res = await fetch(`/api/companions/${companionId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Companion not found');
        return;
      }

      setCompanion(data.companion);
    } catch (error) {
      console.error('Error fetching companion:', error);
      setError('Failed to load companion');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !companion) {
    return (
      <Card className="text-center py-12">
        <p className="text-error mb-4">{error || 'Companion not found'}</p>
        <Link href="/client/browse">
          <Button>Browse Companions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-charcoal-border">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'reviews', label: `Reviews (${companion.reviewCount || 0})` },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-gold border-b-2 border-gold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <CompanionProfile
            companion={companion}
            onChatClick={handleChatRequest}
            onBookClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
            showActions={companion.accessible}
          />
        )}

        {activeTab === 'reviews' && (
          <Card>
            <ReviewSection
              companionId={companion.id}
              averageRating={companion.averageRating || 0}
              reviewCount={companion.reviewCount || 0}
            />
          </Card>
        )}
      </div>

      <div id="booking-form" className="space-y-6">
        <Card className="sticky top-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Book This Companion</h2>
            {companion.isVerified && (
              <Badge className="bg-green-500/20 text-green-400">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </Badge>
            )}
          </div>

          <BookingForm
            companionId={companion.id}
            companionName={companion.name}
            hourlyRate={companion.hourlyRate}
            availability={companion.availability || []}
          />
        </Card>
      </div>

      {/* Chat request overlay */}
      {chatRequestStatus !== 'idle' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <Card className="max-w-sm w-full p-8 text-center space-y-5">
            {chatRequestStatus === 'sending' && (
              <>
                <div className="animate-spin h-10 w-10 border-2 border-gold border-t-transparent rounded-full mx-auto" />
                <p className="text-white font-medium">Sending request…</p>
              </>
            )}

            {chatRequestStatus === 'waiting' && (
              <>
                <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">Waiting for {companion.name}…</p>
                  <p className="text-white/50 text-sm mt-1">Request expires in {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
                </div>
                <div className="w-full bg-charcoal-border rounded-full h-1">
                  <div
                    className="bg-gold h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / CHAT_REQUEST_TIMEOUT_S) * 100}%` }}
                  />
                </div>
                <Button variant="outline" onClick={() => setChatRequestStatus('idle')} className="w-full">
                  Cancel
                </Button>
              </>
            )}

            {chatRequestStatus === 'accepted' && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Request accepted! Joining chat…</p>
              </>
            )}

            {chatRequestStatus === 'declined' && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">{companion.name} declined the request</p>
                  <p className="text-white/50 text-sm mt-1">Try again later</p>
                </div>
                <Button onClick={() => setChatRequestStatus('idle')} className="w-full">Close</Button>
              </>
            )}

            {chatRequestStatus === 'expired' && (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Companion unavailable</p>
                  <p className="text-white/50 text-sm mt-1">{companion.name} didn&apos;t respond in time</p>
                </div>
                <Button onClick={() => setChatRequestStatus('idle')} className="w-full">Try Again</Button>
              </>
            )}

            {chatRequestStatus === 'insufficient_balance' && (
              <>
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Insufficient Balance</p>
                  {insufficientBalanceDetails ? (
                    <p className="text-white/50 text-sm mt-1">
                      You need ₹{(insufficientBalanceDetails.required / 100).toFixed(0)} (10 min) to start.{' '}
                      Current balance: ₹{(insufficientBalanceDetails.current / 100).toFixed(0)}.{' '}
                      Add ₹{((insufficientBalanceDetails.required - insufficientBalanceDetails.current) / 100).toFixed(0)} to continue.
                    </p>
                  ) : (
                    <p className="text-white/50 text-sm mt-1">Add money to your wallet to start a chat session.</p>
                  )}
                </div>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={() => setChatRequestStatus('idle')} className="flex-1">Cancel</Button>
                  <Button onClick={() => router.push('/client/wallet')} className="flex-1">Add Money</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
