import { prisma } from '@/lib/prisma';
import type { Wallet, WalletTransaction } from '@prisma/client';

export type { Wallet, WalletTransaction };

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
 * Returns the WalletTransaction record.
 */
export async function creditWallet(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>
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
        type: 'RECHARGE',
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
 * Returns the WalletTransaction record.
 */
export async function debitWallet(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, unknown>
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
        type: 'DEBIT',
        amount,
        balanceAfter: newBalance,
        description,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  });
}
