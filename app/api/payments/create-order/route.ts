import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getKeyId } from '@/lib/payment';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { amount, type, bookingId, metadata } = await req.json();

    if (!amount || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const receipt = `${type}_${Date.now()}`;
    const order = await createOrder(amount, receipt, {
      userId: payload.id,
      type,
      bookingId: bookingId || '',
    });

    // Save payment record
    await prisma.payment.create({
      data: {
        userId: payload.id,
        type,
        amount,
        razorpayOrderId: order.id,
        bookingId,
        metadata: JSON.stringify(metadata || {}),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getKeyId(),
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
