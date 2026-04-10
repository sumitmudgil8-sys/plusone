import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PRICE_PAISE } from '@/lib/constants';

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || '';
const PAYMENT_WINDOW_MINUTES = 15;

function buildUpiUrl(upiId: string, amountPaise: number, refSuffix: string): string {
  const amountRupees = (amountPaise / 100).toFixed(2);
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Plus One')}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Plus One Subscription ${refSuffix}`)}`;
}

function paymentToResponse(payment: {
  id: string;
  requestedAmount: number;
  uniqueAmount: number;
  upiId: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  adminNote: string | null;
}, reused: boolean) {
  return {
    id: payment.id,
    requestedAmount: payment.requestedAmount,
    uniqueAmount: payment.uniqueAmount,
    status: payment.status,
    upiId: payment.upiId,
    upiUrl: buildUpiUrl(payment.upiId, payment.uniqueAmount, payment.id.slice(-6)),
    expiresAt: payment.expiresAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    resolvedAt: payment.resolvedAt?.toISOString() ?? null,
    adminNote: payment.adminNote,
    reused,
  };
}

/**
 * Generate a unique paise amount by adjusting ±1–99 paise from the requested amount.
 * Checks against all currently PENDING manual payments to avoid collisions.
 */
async function generateUniqueAmount(requestedPaise: number): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const sign = Math.random() > 0.5 ? 1 : -1;
    const offset = Math.floor(Math.random() * 99) + 1;
    const candidate = requestedPaise + sign * offset;

    if (candidate <= 0) continue;

    const collision = await prisma.manualPayment.findFirst({
      where: {
        uniqueAmount: candidate,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (!collision) return candidate;
  }

  const fallbackOffset = (Date.now() % 99) + 1;
  return requestedPaise + fallbackOffset;
}

/**
 * POST /api/subscription/manual-payment
 * Client creates a manual UPI subscription payment request.
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (!auth.user) return auth.response;

  if (!MERCHANT_UPI_ID) {
    return NextResponse.json(
      { success: false, error: 'Payment system not configured. Please contact support.' },
      { status: 503 }
    );
  }

  // Check if user already has an active subscription
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { subscriptionStatus: true, subscriptionExpiresAt: true },
  });

  if (
    user?.subscriptionStatus === 'ACTIVE' &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt > new Date()
  ) {
    return NextResponse.json(
      { success: false, error: 'You already have an active subscription.' },
      { status: 409 }
    );
  }

  // Auto-expire any stale PENDING subscription payments for this user
  await prisma.manualPayment.updateMany({
    where: {
      userId: auth.user.id,
      type: 'SUBSCRIPTION',
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  // Check if user already has an active (non-expired) PENDING subscription payment
  const existingPending = await prisma.manualPayment.findFirst({
    where: {
      userId: auth.user.id,
      type: 'SUBSCRIPTION',
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });

  if (existingPending) {
    return NextResponse.json({
      success: true,
      data: paymentToResponse(existingPending, true),
    });
  }

  // Generate unique amount from subscription price
  const uniqueAmount = await generateUniqueAmount(SUBSCRIPTION_PRICE_PAISE);
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

  const payment = await prisma.manualPayment.create({
    data: {
      userId: auth.user.id,
      requestedAmount: SUBSCRIPTION_PRICE_PAISE,
      uniqueAmount,
      type: 'SUBSCRIPTION',
      upiId: MERCHANT_UPI_ID,
      expiresAt,
    },
  });

  return NextResponse.json({
    success: true,
    data: paymentToResponse(payment, false),
  });
}

/**
 * GET /api/subscription/manual-payment
 * Client checks status of their current/recent subscription payment.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (!auth.user) return auth.response;

  // Auto-expire stale PENDING subscription payments
  await prisma.manualPayment.updateMany({
    where: {
      userId: auth.user.id,
      type: 'SUBSCRIPTION',
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  // Get the latest pending or recently resolved subscription payment (within last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const payment = await prisma.manualPayment.findFirst({
    where: {
      userId: auth.user.id,
      type: 'SUBSCRIPTION',
      OR: [
        { status: 'PENDING' },
        { resolvedAt: { gte: oneHourAgo } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    return NextResponse.json({ success: true, data: { payment: null } });
  }

  return NextResponse.json({
    success: true,
    data: {
      payment: {
        id: payment.id,
        requestedAmount: payment.requestedAmount,
        uniqueAmount: payment.uniqueAmount,
        status: payment.status,
        upiId: payment.upiId,
        upiUrl: buildUpiUrl(payment.upiId, payment.uniqueAmount, payment.id.slice(-6)),
        expiresAt: payment.expiresAt.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        resolvedAt: payment.resolvedAt?.toISOString() ?? null,
        adminNote: payment.adminNote,
      },
    },
  });
}
