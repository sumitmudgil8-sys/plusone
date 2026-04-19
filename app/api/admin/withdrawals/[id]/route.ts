import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { debitWallet } from '@/lib/wallet';
import { sendPushToUser } from '@/lib/push';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'mark_paid']),
  adminNote: z.string().max(500).optional(),
});

// PATCH /api/admin/withdrawals/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { action, adminNote } = parsed.data;

  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id: params.id },
  });

  if (!withdrawal) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updateData: {
    status: 'APPROVED' | 'REJECTED' | 'PAID';
    adminNote?: string;
    resolvedAt?: Date;
  } = {
    status: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'PAID',
  };

  if (action === 'reject' || action === 'mark_paid') {
    updateData.resolvedAt = new Date();
  }
  if (adminNote) {
    updateData.adminNote = adminNote;
  }

  const updated = await prisma.withdrawalRequest.update({
    where: { id: params.id },
    data: updateData,
  });

  // Debit companion wallet when payout is confirmed so wallet.balance stays
  // in sync with what has actually been disbursed.
  if (action === 'mark_paid') {
    try {
      await debitWallet(
        withdrawal.companionId,
        withdrawal.amount,
        `Withdrawal payout — ₹${Math.round(withdrawal.amount / 100)}`,
        { withdrawalId: params.id },
        'PAYOUT'
      );
    } catch (err) {
      console.error('Wallet debit on payout failed (non-fatal):', err);
    }
  }

  const auditAction =
    action === 'approve'
      ? AdminAction.WITHDRAWAL_APPROVE
      : action === 'mark_paid'
      ? AdminAction.WITHDRAWAL_PAY
      : AdminAction.WITHDRAWAL_REJECT;
  await recordAdminAction({
    adminId: auth.user.id,
    action: auditAction,
    targetType: 'WithdrawalRequest',
    targetId: params.id,
    reason: adminNote,
    metadata: {
      companionId: withdrawal.companionId,
      amount: withdrawal.amount,
    },
  });

  const amountRupees = Math.round(withdrawal.amount / 100);

  // Push notification to companion
  const pushPayload =
    action === 'approve'
      ? {
          title: 'Withdrawal Approved',
          body: `₹${amountRupees} withdrawal has been approved`,
          url: '/companion/earnings',
        }
      : action === 'mark_paid'
      ? {
          title: 'Payment Sent',
          body: `₹${amountRupees} has been sent to your account`,
          url: '/companion/earnings',
        }
      : {
          title: 'Withdrawal Rejected',
          body: adminNote ? `Reason: ${adminNote}` : `₹${amountRupees} withdrawal was rejected`,
          url: '/companion/earnings',
        };

  await sendPushToUser(withdrawal.companionId, pushPayload);

  return NextResponse.json({ success: true, data: { withdrawal: updated } });
}
