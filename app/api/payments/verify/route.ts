import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/payment';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';

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

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = await req.json();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    const isValid = verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Update payment record
    const payment = await prisma.payment.update({
      where: { razorpayOrderId },
      data: {
        status: 'COMPLETED',
        razorpayPaymentId,
        razorpaySignature,
      },
      include: { user: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Handle different payment types
    if (payment.type === 'SUBSCRIPTION') {
      await prisma.user.update({
        where: { id: payment.userId },
        data: { subscriptionTier: 'PREMIUM' },
      });

      // Send confirmation email
      if (payment.user.email) {
        const template = emailTemplates.paymentReceived(
          payment.user.email.split('@')[0],
          `₹${payment.amount}`,
          'Premium Subscription'
        );
        await sendEmail(payment.user.email, template.subject, template.html);
      }
    } else if (payment.type === 'BOOKING_DEPOSIT' && payment.bookingId) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'DEPOSIT_PAID' },
      });
    } else if (payment.type === 'BOOKING_FULL' && payment.bookingId) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: 'PAID' },
      });
    }

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}
