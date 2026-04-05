import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/setu';
import { getAblyClient } from '@/lib/ably';

export const runtime = 'nodejs';

// Setu sends the payment status as one of these strings
const SETU_SUCCESS_STATUS = 'CREDIT_RECEIVED';
const SETU_FAILURE_STATUSES = new Set(['FAILED', 'EXPIRED', 'CANCELLED']);

// Setu webhook payload shape (Collect / Payment Links product)
interface SetuWebhookPayload {
  paymentDetails?: {
    platformBillID?: string;
    status?: string;
    amount?: {
      value?: number;
      currencyCode?: string;
    };
  };
  // some events use a top-level billID
  billID?: string;
  status?: string;
}

// POST /api/webhooks/setu
// Receives payment status callbacks from Setu Collect.
// Must return 200 on all paths — Setu retries on non-2xx responses.
export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();

  // 2. Verify Setu webhook signature (JWT in x-setu-signature header)
  const signature = request.headers.get('x-setu-signature') ?? '';
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[setu-webhook] Invalid signature — rejected');
    return NextResponse.json(
      { success: false, error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // 3. Parse payload
  let payload: SetuWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SetuWebhookPayload;
  } catch {
    console.warn('[setu-webhook] Unparseable body');
    return NextResponse.json({ success: false, error: 'Bad JSON' }, { status: 400 });
  }

  // 4. Extract fields — Setu wraps these under paymentDetails
  const details = payload.paymentDetails ?? {};
  const setuPaymentId = details.platformBillID ?? payload.billID;
  const incomingStatus = details.status ?? payload.status;
  const amountInPaise = details.amount?.value;

  if (!setuPaymentId || !incomingStatus) {
    console.warn('[setu-webhook] Missing paymentId or status in payload', payload);
    // Return 200 so Setu doesn't retry an unrecognised event shape
    return NextResponse.json({ success: true });
  }

  // 5. Look up the SetuPayment record
  const setuPayment = await prisma.setuPayment.findUnique({
    where: { setuPaymentId },
  });

  if (!setuPayment) {
    // Could be a link we didn't create (e.g. stale sandbox event) — log and ack
    console.warn('[setu-webhook] Unknown setuPaymentId:', setuPaymentId);
    return NextResponse.json({ success: true });
  }

  // 6. Idempotency guard — ignore replays for already-settled records
  if (setuPayment.status !== 'PENDING') {
    console.info(
      '[setu-webhook] Already processed setuPaymentId:',
      setuPaymentId,
      'status:',
      setuPayment.status
    );
    return NextResponse.json({ success: true });
  }

  // 7a. Payment succeeded
  if (incomingStatus === SETU_SUCCESS_STATUS) {
    // Use Setu-reported amount if available, fall back to the amount we stored.
    // Wallet now stores balance in paise (Int) — no conversion needed.
    const confirmedPaise = amountInPaise ?? setuPayment.amount;

    let newBalance = 0;

    try {
      // Single atomic transaction: credit wallet + mark SetuPayment COMPLETED.
      // We inline the wallet credit logic here (rather than calling creditWallet())
      // because creditWallet() opens its own prisma.$transaction internally and
      // Prisma does not support nested interactive transactions.
      await prisma.$transaction(async (tx) => {
        await tx.wallet.upsert({
          where: { userId: setuPayment.userId },
          create: { userId: setuPayment.userId, balance: confirmedPaise },
          update: { balance: { increment: confirmedPaise } },
        });

        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: setuPayment.userId },
        });
        newBalance = wallet.balance;

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'RECHARGE',
            amount: confirmedPaise,
            balanceAfter: wallet.balance,
            description: 'Wallet recharge via UPI',
            metadata: JSON.stringify({ setuPaymentId }),
          },
        });

        await tx.setuPayment.update({
          where: { id: setuPayment.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      });
    } catch (err) {
      console.error('[setu-webhook] Failed to credit wallet:', err);
      // Return 500 so Setu retries — the idempotency guard above protects
      // against double-credits on retry because the DB record stays PENDING
      // until the transaction commits.
      return NextResponse.json(
        { success: false, error: 'Internal error' },
        { status: 500 }
      );
    }

    // 8. Notify the client in real-time via Ably (best-effort, non-fatal)
    try {
      const ably = getAblyClient();
      const channel = ably.channels.get(`wallet:${setuPayment.userId}`);
      await channel.publish('recharge_success', {
        newBalance,
        amount: confirmedPaise,
        setuPaymentId,
      });
    } catch (ablyErr) {
      console.warn('[setu-webhook] Ably publish failed (non-fatal):', ablyErr);
    }

    return NextResponse.json({ success: true });
  }

  // 7b. Payment failed / expired / cancelled
  if (SETU_FAILURE_STATUSES.has(incomingStatus)) {
    try {
      const mappedStatus =
        incomingStatus === 'EXPIRED' ? 'EXPIRED' : 'FAILED';
      await prisma.setuPayment.update({
        where: { id: setuPayment.id },
        data: { status: mappedStatus },
      });
    } catch (err) {
      console.error('[setu-webhook] Failed to update SetuPayment status:', err);
      return NextResponse.json(
        { success: false, error: 'Internal error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  // 7c. Unknown/intermediate status — log and ack without state change
  console.info('[setu-webhook] Unhandled status:', incomingStatus, 'for', setuPaymentId);
  return NextResponse.json({ success: true });
}
