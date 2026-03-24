export const MESSAGE_LIMIT = 8;
export const MAX_FREE_COMPANIONS = 20;
export const SUBSCRIPTION_PRICE = 5000; // INR
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
