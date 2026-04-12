import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createPaymentLink } from '@/lib/setu';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PRICE_PAISE } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/subscription/create — create a Setu UPI payment link for monthly subscription
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    // Check for an existing PENDING subscription payment in last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await prisma.setuPayment.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
        amount: SUBSCRIPTION_PRICE_PAISE,
        createdAt: { gte: thirtyMinutesAgo },
        expiresAt: { gt: new Date() },
        metadata: { path: ['type'], equals: 'subscription' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          setuPaymentId: existing.setuPaymentId,
          upiLink: existing.upiLink,
          qrCode: existing.qrCode,
          shortUrl: existing.shortUrl,
          expiresAt: existing.expiresAt,
          reused: true,
        },
      });
    }

    const link = await createPaymentLink(user.id, SUBSCRIPTION_PRICE_PAISE);

    const setuPayment = await prisma.setuPayment.create({
      data: {
        userId: user.id,
        setuPaymentId: link.setuPaymentId,
        amount: SUBSCRIPTION_PRICE_PAISE,
        upiLink: link.upiLink,
        qrCode: link.qrCode,
        shortUrl: link.shortUrl,
        expiresAt: new Date(link.expiresAt),
        metadata: { type: 'subscription', plan: 'MONTHLY_4999' },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        setuPaymentId: setuPayment.setuPaymentId,
        upiLink: setuPayment.upiLink,
        qrCode: setuPayment.qrCode,
        shortUrl: setuPayment.shortUrl,
        expiresAt: setuPayment.expiresAt,
        reused: false,
      },
    });
  } catch (error) {
    console.error('Subscription create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription payment' },
      { status: 500 }
    );
  }
}
