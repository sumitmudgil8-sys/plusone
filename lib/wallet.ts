import { prisma } from '@/lib/prisma';
import type { Wallet, WalletTransaction } from '@prisma/client';

export type { Wallet, WalletTransaction };

/**
 * WalletTransaction.type values. Stored as a string in the DB, but constrained
 * by this union so the transaction history stays categorizable.
 *
 * Credit-side types:
 *   RECHARGE      — client topped up via Razorpay / manual UPI
 *   EARNING       — companion earned from per-minute billing tick
 *   REFUND        — admin/system refund to client
 *   HOLD_RELEASE  — previously-held booking deposit released back
 *
 * Debit-side types:
 *   CHAT_CHARGE   — per-minute chat billing debit from client
 *   CALL_CHARGE   — per-minute voice call billing debit from client
 *   PAYOUT        — companion withdrawal paid out
 *   HOLD          — booking deposit held from client
 *   DEBIT         — generic debit (legacy; prefer a specific type)
 */
export type WalletTxCreditType = 'RECHARGE' | 'EARNING' | 'REFUND' | 'HOLD_RELEASE';
export type WalletTxDebitType = 'CHAT_CHARGE' | 'CALL_CHARGE' | 'PAYOUT' | 'HOLD' | 'DEBIT';

/** Returns the wallet for a user, creating one if it doesn't exist. */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

/**
 * Credits the wallet atomically.
 * Creates the wallet if it doesn't exist yet.
 * `type` defaults to 'RECHARGE' for backwards compatibility with older call
 * sites; new credit paths should pass an explicit type.
 * Returns the WalletTransaction record.
 */
export async function creditWallet(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>,
  type: WalletTxCreditType = 'RECHARGE'
): Promise<WalletTransaction> {
  return prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    });

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        balanceAfter: wallet.balance,
        description,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  });
}

/**
 * Debits the wallet atomically.
 * Throws 'INSUFFICIENT_BALANCE' if the balance is too low.
 * `type` defaults to 'DEBIT' for backwards compatibility.
 * Returns the WalletTransaction record.
 */
export async function debitWallet(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>,
  type: WalletTxDebitType = 'DEBIT'
): Promise<WalletTransaction> {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    if (wallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

    const newBalance = wallet.balance - amount;

    await tx.wallet.update({
      where: { userId },
      data: { balance: newBalance },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        balanceAfter: newBalance,
        description,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  });
}
