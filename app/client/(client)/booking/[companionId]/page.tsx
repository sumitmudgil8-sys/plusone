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

type ChatRequestStatus = 'idle' | 'sending' | 'waiting' | 'accepted' | 'declined' | 'expired';

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
  const [chatRequestId, setChatRequestId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHAT_REQUEST_TIMEOUT_S);

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

  // Subscribe to chat request response events via Ably
  const { onChatRequestResponse } = useSocket(userId, 'CLIENT');

  useEffect(() => {
    const unsubscribe = onChatRequestResponse((data) => {
      if (data.requestId !== chatRequestId) return;
      if (data.status === 'ACCEPTED') {
        setChatRequestStatus('accepted');
        // Small delay so the user sees the "Accepted" state before navigating
        setTimeout(() => router.push(`/client/chat/${companionId}`), 800);
      } else {
        setChatRequestStatus('declined');
      }
    });
    return unsubscribe;
  }, [onChatRequestResponse, chatRequestId, companionId, router]);

  // Countdown timer while waiting
  useEffect(() => {
    if (chatRequestStatus !== 'waiting') return;
    setTimeLeft(CHAT_REQUEST_TIMEOUT_S);

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
  }, [chatRequestStatus]);

  const handleChatRequest = useCallback(async () => {
    setChatRequestStatus('sending');
    try {
      const res = await fetch('/api/chat-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChatRequestStatus('idle');
        return;
      }
      setChatRequestId(data.data.requestId);
      setChatRequestStatus('waiting');
    } catch {
      setChatRequestStatus('idle');
    }
  }, [companionId]);

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
          </Card>
        </div>
      )}
    </div>
  );
}
