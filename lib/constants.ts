export const MESSAGE_LIMIT = 8;
export const UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024;    // 5 MB
export const UPLOAD_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const UPLOAD_ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const COMPANION_GALLERY_MAX_IMAGES = 8;

export const BILLING_TICK_SECONDS = 60;        // bill every 60s
export const BILLING_GRACE_SECONDS = 120;      // session auto-expires if no tick for 2 min
export const BILLING_MIN_BALANCE_MINUTES = 1;  // must have ≥1 min balance to start
export const PLATFORM_COMMISSION_RATE = 0.20;  // 20% platform cut; companion gets 80%

export const WALLET_MIN_RECHARGE = 100;   // INR
export const WALLET_MAX_RECHARGE = 50000; // INR
export const WALLET_RECHARGE_PRESETS = [100, 200, 500, 1000, 2000]; // INR
export const MAX_FREE_COMPANIONS = 15; // first N profiles free without wallet balance
export const DEPOSIT_PERCENTAGE = 20; // 20% deposit required

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
