"use client";
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: {
    clientProfile: {
      name: string;
      avatarUrl: string | null;
    } | null;
  };
}

interface ReviewSectionProps {
  companionId: string;
  averageRating: number;
  reviewCount: number;
}

export function ReviewSection({ companionId, averageRating, reviewCount }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [companionId]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?companionId=${companionId}`);
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: string = 'w-4 h-4') => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${size} ${star <= rating ? 'text-gold fill-current' : 'text-white/20'}`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-white/10 rounded w-1/3"></div>
        <div className="h-20 bg-white/10 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="text-4xl font-bold text-white">{averageRating.toFixed(1)}</div>
        <div className="space-y-1">
          {renderStars(Math.round(averageRating), 'w-5 h-5')}
          <p className="text-white/60 text-sm">{reviewCount} reviews</p>
        </div>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-charcoal border border-charcoal-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-charcoal-border overflow-hidden">
                    {review.reviewer?.clientProfile?.avatarUrl ? (
                      <img
                        src={review.reviewer.clientProfile.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{review.reviewer?.clientProfile?.name || 'Anonymous'}</p>
                    <p className="text-xs text-white/40">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>
              <p className="text-white/80">{review.comment}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/40 text-center py-8">No reviews yet</p>
      )}
    </div>
  );
}

interface ReviewFormProps {
  bookingId: string;
  companionName: string;
  onSubmit: () => void;
}

export function ReviewForm({ bookingId, companionName, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          rating,
          comment,
        }),
      });

      if (res.ok) {
        onSubmit();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Rate your experience with {companionName}</h3>

      <div className="mb-4">
        <p className="text-white/70 text-sm mb-2">How was your experience?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              className="p-1"
            >
              <svg
                className={`w-8 h-8 transition-colors ${
                  star <= (hoveredRating || rating)
                    ? 'text-gold fill-current'
                    : 'text-white/20'
                }`}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-white/70 text-sm mb-2">Tell us about your experience (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Share your thoughts..."
          className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2 focus:border-gold focus:outline-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className="w-full"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </Button>
    </div>
  );
}
