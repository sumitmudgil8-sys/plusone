import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WALLET_MIN_RECHARGE, WALLET_MAX_RECHARGE } from '@/lib/constants';
import { manualPaymentLimiter } from '@/lib/rate-limit';

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || '';
const PAYMENT_WINDOW_MINUTES = 15;

function buildUpiUrl(upiId: string, amountPaise: number, refSuffix: string): string {
  const amountRupees = (amountPaise / 100).toFixed(2);
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('Plus One')}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Plus One Wallet ${refSuffix}`)}`;
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
 * POST /api/wallet/manual-recharge
 * Client creates a manual UPI payment request.
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (!auth.user) return auth.response;

  // Rate-limit by user id so one attacker account can't spawn unbounded
  // PENDING manual payments (which each hit the admin queue + scan bank feed).
  const rl = manualPaymentLimiter.check(`manual-recharge:${auth.user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many payment requests. Try again in ${rl.retryAfter}s.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  if (!MERCHANT_UPI_ID) {
    return NextResponse.json(
      { success: false, error: 'Payment system not configured. Please contact support.' },
      { status: 503 }
    );
  }

  let body: { amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { amount } = body;

  if (!amount || typeof amount !== 'number' || !Number.isInteger(amount)) {
    return NextResponse.json(
      { success: false, error: 'Amount must be an integer in paise' },
      { status: 400 }
    );
  }

  if (amount < WALLET_MIN_RECHARGE || amount > WALLET_MAX_RECHARGE) {
    return NextResponse.json(
      { success: false, error: `Amount must be between ₹${WALLET_MIN_RECHARGE / 100} and ₹${WALLET_MAX_RECHARGE / 100}` },
      { status: 400 }
    );
  }

  // Auto-expire any stale PENDING payments for this user
  await prisma.manualPayment.updateMany({
    where: {
      userId: auth.user.id,
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  // Check if user already has an active (non-expired) PENDING payment
  const existingPending = await prisma.manualPayment.findFirst({
    where: {
      userId: auth.user.id,
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

  // Generate unique amount
  const uniqueAmount = await generateUniqueAmount(amount);
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

  const payment = await prisma.manualPayment.create({
    data: {
      userId: auth.user.id,
      requestedAmount: amount,
      uniqueAmount,
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
 * GET /api/wallet/manual-recharge
 * Client checks status of their current/recent manual payment.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (!auth.user) return auth.response;

  // Auto-expire stale PENDING payments
  await prisma.manualPayment.updateMany({
    where: {
      userId: auth.user.id,
      status: 'PENDING',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  // Get the latest pending or recently resolved payment (within last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const payment = await prisma.manualPayment.findFirst({
    where: {
      userId: auth.user.id,
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
