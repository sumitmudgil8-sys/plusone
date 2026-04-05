'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { CompanionProfile } from '@/components/companion/CompanionProfile';
import { ReviewSection } from '@/components/reviews/ReviewComponents';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function BookingPage() {
  const params = useParams();
  const companionId = params.companionId as string;

  const [companion, setCompanion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChatPrompt, setShowChatPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (companionId) {
      fetchCompanion();
    }

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
            onChatClick={() => setShowChatPrompt(true)}
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

      {showChatPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-medium text-white mb-4">Start a Conversation</h3>
            <p className="text-white/60 mb-6">
              You can chat with {companion.name} before booking.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowChatPrompt(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Link href={`/client/chat/${companion.id}`} className="flex-1">
                <Button className="w-full">Start Chat</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
