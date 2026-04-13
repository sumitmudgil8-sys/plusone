// MESSAGE_LIMIT removed — chat is now per-minute billed (paid-only, no free message cap)

export const UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024;    // 5 MB
export const UPLOAD_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const UPLOAD_ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const COMPANION_GALLERY_MAX_IMAGES = 8;

export const BILLING_TICK_SECONDS = 60;        // bill every 60s
export const BILLING_GRACE_SECONDS = 120;      // session auto-expires if no tick for 2 min
export const BILLING_MIN_BALANCE_MINUTES = 1;  // must have ≥1 min balance to start
export const BILLING_MAX_DURATION_MINUTES = 60; // hard cap — auto-end after 60 min
export const PLATFORM_COMMISSION_RATE = 0.20;  // 20% platform cut; companion gets 80%

// Wallet recharge limits — all in paise
export const WALLET_MIN_RECHARGE = 10000;   // ₹100
export const WALLET_MAX_RECHARGE = 5000000; // ₹50,000
export const WALLET_RECHARGE_PRESETS = [10000, 20000, 50000, 100000, 200000]; // ₹100/200/500/1000/2000

export const MAX_FREE_COMPANIONS = 10;          // free tier sees first 10 cards; rest are blurred
export const SUBSCRIPTION_PRICE_PAISE = 499900; // ₹4,999/month (GOLD tier)
export const DEPOSIT_PERCENTAGE = 20; // 20% deposit required

// Scheduled sessions (available to all users)
export const SCHEDULED_DURATIONS = [15, 30] as const;          // minutes
export const SCHEDULED_HOLD_RATE = 0.30;                       // 30% hold on estimated total
export const SCHEDULED_CANCEL_WINDOW_MINUTES = 60;             // free cancel if > 1h before
export const SCHEDULED_NO_SHOW_WINDOW_MINUTES = 5;             // 5 min grace after scheduled start
export const SCHEDULED_MIN_ADVANCE_MINUTES = 60;               // must book at least 1h in advance
export const SCHEDULED_MAX_ADVANCE_DAYS = 7;                   // max 7 days in advance
export const SCHEDULED_ACTIVATION_WINDOW_MINUTES = 10;         // can activate up to 10 min before/after

// Ranking score weights (must sum to 1.0)
export const RANKING_WEIGHT_AVAILABILITY = 0.40;
export const RANKING_WEIGHT_QUALITY = 0.25;
export const RANKING_WEIGHT_RESPONSIVENESS = 0.20;
export const RANKING_WEIGHT_RECENCY = 0.15;

// Companion badges
export const BADGE_TOP_RATED_MIN_RATING = 4.5;
export const BADGE_TOP_RATED_MIN_SESSIONS = 20;
export const BADGE_FAST_RESPONDER_MAX_SECONDS = 60;
export const BADGE_ELITE_MIN_SESSIONS = 100;
export const BADGE_ELITE_MIN_MONTHS = 6;
export const BADGE_RISING_STAR_MAX_DAYS = 60;
export const BADGE_RISING_STAR_MIN_RATING = 4.3;
export const BADGE_RISING_STAR_MIN_SESSIONS = 5;

// Session reviews
export const MIN_SESSION_DURATION_FOR_REVIEW = 120; // seconds — must last ≥2 min to leave review

// Presence
export const PRESENCE_OFFLINE_THRESHOLD_MS = 90_000;  // 90s without heartbeat → offline
export const AUTO_OFFLINE_MINUTES = 10;               // auto-offline if no heartbeat for 10 min
export const FAVORITE_NOTIFICATION_THROTTLE_S = 21600; // 6 hours between "X is online" pushes

export const COLORS = {
  background: '#1C1C1C',
  surface: '#2A2A2A',
  border: '#3A3A3A',
  gold: '#D4AF37',
  goldHover: '#C49B27',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  error: '#EF4444',
  success: '#22C55E',
};

export const INTERESTS = [
  'Art', 'Fine Dining', 'Travel', 'Photography', 'Music', 'Movies',
  'Sports', 'Fitness', 'Reading', 'Business', 'Hiking', 'Dancing',
  'Exploring', 'Literature', 'Golf', 'Wine Tasting', 'Food', 'Gaming'
];

export const LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi',
  'Gujarati', 'Punjabi', 'Urdu', 'Kannada', 'Malayalam'
];

export const GENDERS = ['Male', 'Female', 'Non-binary'];

export const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const NOTIFICATION_TYPES = {
  BOOKING: 'BOOKING',
  MESSAGE: 'MESSAGE',
  PAYMENT: 'PAYMENT',
  VERIFICATION: 'VERIFICATION',
  SAFETY: 'SAFETY',
};

export const SAFETY_CHECKIN_INTERVALS = [30, 60, 90, 120]; // minutes

export const RAZORPAY_CONFIG = {
  currency: 'INR',
  name: 'Plus One',
  description: 'Premium Social Companionship',
  theme: {
    color: '#D4AF37',
  },
};
