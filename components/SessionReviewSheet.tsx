'use client';

import { useState, useCallback } from 'react';

interface SessionReviewSheetProps {
  sessionId: string;
  companionName: string;
  sessionType: 'CHAT' | 'VOICE';
  onSubmit: () => void;
  onSkip: () => void;
}

export function SessionReviewSheet({
  sessionId,
  companionName,
  sessionType,
  onSubmit,
  onSkip,
}: SessionReviewSheetProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/billing/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to submit review');
        return;
      }
      onSubmit();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, rating, comment, onSubmit]);

  const displayStar = hoveredStar || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 mb-0 sm:mb-0 bg-charcoal-elevated border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="text-center mb-5">
          <p className="text-sm text-white/50 uppercase tracking-wider">
            {sessionType === 'VOICE' ? 'Voice Call' : 'Chat Session'} Ended
          </p>
          <h3 className="text-lg font-semibold text-white mt-1">
            How was your session with {companionName}?
          </h3>
        </div>

        {/* Star rating */}
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <svg
                className={`w-10 h-10 transition-colors ${
                  star <= displayStar ? 'text-gold' : 'text-white/20'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>

        {/* Optional comment */}
        {rating > 0 && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)"
            maxLength={500}
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none mb-4"
          />
        )}

        {error && (
          <p className="text-sm text-error-fg mb-3 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-2.5 rounded-lg border border-white/[0.08] text-white/50 text-sm hover:text-white/70 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 py-2.5 rounded-lg bg-gold hover:bg-gold-hover text-black text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
