export interface User {
  id: string;
  email: string;
  role: 'CLIENT' | 'COMPANION' | 'ADMIN';
  isActive: boolean;
  isBanned: boolean;
  subscriptionTier: 'FREE' | 'PREMIUM';
  createdAt: string;
  updatedAt: string;
  clientProfile?: ClientProfile;
  companionProfile?: CompanionProfile;
}

export interface ClientProfile {
  id: string;
  userId: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  phone?: string;
  lat: number;
  lng: number;
  shareItinerary: boolean;
  trustedContact?: string;
  trustedContactPhone?: string;
}

export interface CompanionProfile {
  id: string;
  userId: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  images: string;
  hourlyRate: number;
  isApproved: boolean;
  isVerified: boolean;
  lat: number;
  lng: number;
  availability: string;
  gender?: string;
  age?: number;
  languages: string;
  interests: string;
  verificationStatus: string;
  averageRating: number;
  reviewCount: number;
}

export interface Booking {
  id: string;
  clientId: string;
  companionId: string;
  date: string;
  duration: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  totalAmount: number;
  depositAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED';
  paymentId?: string;
  notes?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  client?: User;
  companion?: User;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: User;
  receiver?: User;
}

export interface MessageThread {
  id: string;
  clientId: string;
  companionId: string;
  messageCount: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  client?: User;
  companion?: User;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  createdAt: string;
  reviewer?: User;
  reviewed?: User;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  bookingId?: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}
