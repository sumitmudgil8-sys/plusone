import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';

/**
 * PATCH /api/admin/payments/[id]
 * Admin approves or rejects a manual payment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request, ['ADMIN']);
  if (!auth.user) return auth.response;

  const { id } = await params;

  let body: { action?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { action, adminNote } = body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  // Fetch the payment
  const payment = await prisma.manualPayment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
    },
  });

  if (!payment) {
    return NextResponse.json(
      { success: false, error: 'Payment not found' },
      { status: 404 }
    );
  }

  // Only PENDING payments can be approved/rejected
  if (payment.status !== 'PENDING') {
    return NextResponse.json(
      { success: false, error: `Payment is already ${payment.status.toLowerCase()}` },
      { status: 409 }
    );
  }

  // Check if expired
  if (payment.expiresAt < new Date()) {
    await prisma.manualPayment.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json(
      { success: false, error: 'Payment window has expired' },
      { status: 410 }
    );
  }

  if (action === 'reject') {
    await prisma.manualPayment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNote: adminNote || null,
        resolvedAt: new Date(),
      },
    });

    await recordAdminAction({
      adminId: auth.user.id,
      action: AdminAction.PAYMENT_REJECT,
      targetType: 'ManualPayment',
      targetId: id,
      reason: adminNote,
      metadata: {
        userId: payment.userId,
        type: payment.type,
        amount: payment.uniqueAmount,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Payment rejected' },
    });
  }

  // ── Approve: atomic credit/activation + status update ──
  // Use a transaction to prevent double-crediting
  const isSubscription = payment.type === 'SUBSCRIPTION';

  try {
    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent race conditions
      const fresh = await tx.manualPayment.findUniqueOrThrow({ where: { id } });
      if (fresh.status !== 'PENDING') {
        throw new Error(`ALREADY_${fresh.status}`);
      }

      // Mark payment as approved
      await tx.manualPayment.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNote: adminNote || null,
          resolvedAt: new Date(),
        },
      });

      if (fresh.type === 'SUBSCRIPTION') {
        // ── Subscription: activate the user's subscription ──
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await tx.user.update({
          where: { id: payment.userId },
          data: {
            subscriptionTier: 'PREMIUM',
            subscriptionStatus: 'ACTIVE',
            subscriptionPlan: 'MONTHLY_2999',
            subscriptionExpiresAt: expiresAt,
          },
        });
      } else {
        // ── Wallet: credit the wallet with the unique amount ──
        await tx.wallet.upsert({
          where: { userId: payment.userId },
          create: { userId: payment.userId, balance: fresh.uniqueAmount },
          update: { balance: { increment: fresh.uniqueAmount } },
        });

        const updatedWallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: payment.userId },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: updatedWallet.id,
            type: 'RECHARGE',
            amount: fresh.uniqueAmount,
            balanceAfter: updatedWallet.balance,
            description: `Wallet recharge (manual UPI verification)`,
            metadata: JSON.stringify({
              manualPaymentId: id,
              requestedAmount: fresh.requestedAmount,
              uniqueAmount: fresh.uniqueAmount,
            }),
          },
        });
      }
    });

    await recordAdminAction({
      adminId: auth.user.id,
      action: AdminAction.PAYMENT_APPROVE,
      targetType: 'ManualPayment',
      targetId: id,
      reason: adminNote,
      metadata: {
        userId: payment.userId,
        type: payment.type,
        amount: payment.uniqueAmount,
        isSubscription,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: isSubscription
          ? 'Subscription activated'
          : 'Payment approved and wallet credited',
        userId: payment.userId,
        amount: payment.uniqueAmount,
        type: payment.type ?? 'WALLET',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.startsWith('ALREADY_')) {
      return NextResponse.json(
        { success: false, error: 'Payment was already processed' },
        { status: 409 }
      );
    }
    console.error('Manual payment approval failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
