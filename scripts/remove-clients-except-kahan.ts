/**
 * Removes all APPROVED CLIENT accounts except kahangupta@adelindia.com.
 * Handles non-cascade FK relations in the correct order to avoid constraint errors.
 *
 * Run with: npx tsx scripts/remove-clients-except-kahan.ts
 *           Add --dry-run to preview without deleting.
 */

import { prisma } from '../lib/prisma';

const KEEP_EMAIL = 'kahangupta@adelindia.com';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  // Find all approved clients except the one to keep
  const clients = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      clientStatus: 'APPROVED',
      email: { not: KEEP_EMAIL },
    },
    select: { id: true, email: true },
  });

  if (clients.length === 0) {
    console.log('No approved clients to remove (excluding the kept email).');
    return;
  }

  console.log(`Found ${clients.length} approved client(s) to remove:`);
  clients.forEach((c) => console.log(`  - ${c.email} (${c.id})`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Remove --dry-run to execute.');
    return;
  }

  const ids = clients.map((c) => c.id);

  await prisma.$transaction(async (tx) => {
    // 1. Reviews — reviewer or reviewed is one of the clients
    //    (Reviews with bookingId/billingSessionId cascade when those are deleted,
    //     but reviewer/reviewed FKs have no cascade, so delete explicitly first.)
    const reviewsDel = await tx.review.deleteMany({
      where: { OR: [{ reviewerId: { in: ids } }, { reviewedId: { in: ids } }] },
    });
    console.log(`Deleted ${reviewsDel.count} review(s).`);

    // 2. ScheduledSessions — must go before BillingSessions
    //    (ScheduledSession.billingSessionId → BillingSession is a non-cascade FK)
    const scheduledDel = await tx.scheduledSession.deleteMany({
      where: { clientId: { in: ids } },
    });
    console.log(`Deleted ${scheduledDel.count} scheduled session(s).`);

    // 3. BillingSessions — Reviews cascade, ScheduledSessions already cleared
    const billingDel = await tx.billingSession.deleteMany({
      where: { clientId: { in: ids } },
    });
    console.log(`Deleted ${billingDel.count} billing session(s).`);

    // 4. Bookings — Reviews cascade, but we already deleted them above
    const bookingDel = await tx.booking.deleteMany({
      where: { clientId: { in: ids } },
    });
    console.log(`Deleted ${bookingDel.count} booking(s).`);

    // 5. Messages sent or received by these clients (non-cascade FK to User)
    const msgDel = await tx.message.deleteMany({
      where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
    });
    console.log(`Deleted ${msgDel.count} message(s).`);

    // 6. MessageThreads (messages already cleared; thread cascade would try again — harmless)
    const threadDel = await tx.messageThread.deleteMany({
      where: { clientId: { in: ids } },
    });
    console.log(`Deleted ${threadDel.count} message thread(s).`);

    // 7. Delete Users — remaining relations all have onDelete: Cascade:
    //    ClientProfile, Wallet (+WalletTransactions), Favorites, Notifications,
    //    EmergencyContact, CheckIns, VerificationDocuments, CompanionProfileView,
    //    CompanionImages, BlockedUsers, Payments, SetuPayments, PushSubscriptions,
    //    FcmTokens, WithdrawalRequests, ManualPayments, ClientVisibility.
    const userDel = await tx.user.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`Deleted ${userDel.count} user(s).`);
  });

  console.log('\nDone. All targeted approved clients removed successfully.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
