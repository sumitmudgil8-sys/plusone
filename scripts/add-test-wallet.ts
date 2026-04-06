import { prisma } from '../lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'client1@test.com' },
    include: { wallet: true },
  });

  if (!user) {
    console.log('User not found: client1@test.com');
    return;
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: 50000 }, // ₹500 in paise
    update: { balance: { increment: 50000 } },
  });

  // balanceAfter = updated balance (re-fetch after upsert increment)
  const updatedWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const balanceAfter = updatedWallet?.balance ?? wallet.balance;

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'RECHARGE',
      amount: 50000,
      balanceAfter,
      description: 'Test wallet credit — ₹500',
    },
  });

  console.log(`Done. New balance: ${balanceAfter} paise = ₹${balanceAfter / 100}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
