import { prisma } from '../lib/prisma';

async function main() {
  const email = 'sumit1@plusone.com';
  const amountPaise = 20_000_000; // ₹2,00,000

  const user = await prisma.user.findUnique({
    where: { email },
    include: { wallet: true },
  });

  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: amountPaise },
    update: { balance: { increment: amountPaise } },
  });

  const updatedWallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  const balanceAfter = updatedWallet?.balance ?? wallet.balance;

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'RECHARGE',
      amount: amountPaise,
      balanceAfter,
      description: 'Manual wallet credit — ₹2,00,000',
    },
  });

  console.log(`Done. New balance: ${balanceAfter} paise = ₹${(balanceAfter / 100).toLocaleString('en-IN')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
