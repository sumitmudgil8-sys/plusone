import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function periodBounds(period: 'today' | 'week' | 'month') {
  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
}

// GET /api/companion/earnings
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const companionId = auth.user.id;

  const todayStart = periodBounds('today');
  const weekStart = periodBounds('week');
  const monthStart = periodBounds('month');

  // All billing sessions (ENDED) + active sessions
  const [
    allChatSessions,
    allCallSessions,
    todayChatSessions,
    todayCallSessions,
    weekChatSessions,
    weekCallSessions,
    monthChatSessions,
    monthCallSessions,
    allBookings,
    todayBookings,
    weekBookings,
    monthBookings,
    withdrawals,
    recentBillingSessions,
    recentBookingRecords,
    activeSessions,
  ] = await Promise.all([
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT' },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE' },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT', endedAt: { gte: todayStart } },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE', endedAt: { gte: todayStart } },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT', endedAt: { gte: weekStart } },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE', endedAt: { gte: weekStart } },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'CHAT', endedAt: { gte: monthStart } },
      _sum: { companionShare: true },
    }),
    prisma.billingSession.aggregate({
      where: { companionId, status: 'ENDED', type: 'VOICE', endedAt: { gte: monthStart } },
      _sum: { companionShare: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED', updatedAt: { gte: todayStart } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED', updatedAt: { gte: weekStart } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { companionId, status: 'COMPLETED', updatedAt: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.withdrawalRequest.findMany({
      where: { companionId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.billingSession.findMany({
      where: { companionId, status: 'ENDED' },
      orderBy: { endedAt: 'desc' },
      take: 20,
      select: {
        type: true, companionShare: true, endedAt: true, createdAt: true, totalMinutes: true,
        client: { select: { clientProfile: { select: { name: true } } } },
      },
    }),
    prisma.booking.findMany({
      where: { companionId, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        totalAmount: true, updatedAt: true,
        client: { select: { clientProfile: { select: { name: true } } } },
      },
    }),
    prisma.billingSession.findMany({
      where: { companionId, status: 'ACTIVE' },
      include: { client: { include: { clientProfile: { select: { name: true } } } } },
    }),
  ]);

  // Compute totals — billing sessions use companionShare (companion cut of totalCharged)
  const fromChats = allChatSessions._sum.companionShare ?? 0;
  const fromCalls = allCallSessions._sum.companionShare ?? 0;
  const fromBookings = allBookings._sum.totalAmount ?? 0;
  const totalEarned = fromChats + fromCalls + fromBookings;

  const paidOut = withdrawals
    .filter((w) => w.status === 'PAID')
    .reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawal = withdrawals
    .filter((w) => w.status === 'PENDING' || w.status === 'APPROVED')
    .reduce((sum, w) => sum + w.amount, 0);
  // Available = earned − already-paid − held-for-payout. Non-terminal
  // withdrawal requests (PENDING + APPROVED) must be held, otherwise
  // companions see inflated "available" figures and hit unexpected
  // insufficient-balance errors on the withdrawal POST.
  const availableBalance = totalEarned - paidOut - pendingWithdrawal;

  // Period breakdowns — all billing figures use companionShare (companion cut)
  const periods = {
    today: {
      chats: todayChatSessions._sum.companionShare ?? 0,
      calls: todayCallSessions._sum.companionShare ?? 0,
      bookings: todayBookings._sum.totalAmount ?? 0,
      total:
        (todayChatSessions._sum.companionShare ?? 0) +
        (todayCallSessions._sum.companionShare ?? 0) +
        (todayBookings._sum.totalAmount ?? 0),
    },
    thisWeek: {
      chats: weekChatSessions._sum.companionShare ?? 0,
      calls: weekCallSessions._sum.companionShare ?? 0,
      bookings: weekBookings._sum.totalAmount ?? 0,
      total:
        (weekChatSessions._sum.companionShare ?? 0) +
        (weekCallSessions._sum.companionShare ?? 0) +
        (weekBookings._sum.totalAmount ?? 0),
    },
    thisMonth: {
      chats: monthChatSessions._sum.companionShare ?? 0,
      calls: monthCallSessions._sum.companionShare ?? 0,
      bookings: monthBookings._sum.totalAmount ?? 0,
      total:
        (monthChatSessions._sum.companionShare ?? 0) +
        (monthCallSessions._sum.companionShare ?? 0) +
        (monthBookings._sum.totalAmount ?? 0),
    },
    allTime: {
      chats: fromChats,
      calls: fromCalls,
      bookings: fromBookings,
      total: totalEarned,
    },
  };

  // Build recent transactions list (merge billing + booking, sort by date, take 20)
  const billingTx = recentBillingSessions.map((s) => ({
    type: s.type === 'VOICE' ? 'CALL' : 'CHAT',
    amount: s.companionShare,
    createdAt: s.endedAt ?? s.createdAt,
    durationMinutes: Math.round(s.totalMinutes),
    clientName: s.client.clientProfile?.name ?? 'Client',
  }));

  const bookingTx = recentBookingRecords.map((b) => ({
    type: 'BOOKING' as const,
    amount: b.totalAmount,
    createdAt: b.updatedAt,
    durationMinutes: undefined as number | undefined,
    clientName: b.client.clientProfile?.name ?? 'Client',
  }));

  const recentTransactions = [...billingTx, ...bookingTx]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalEarned,
        pendingWithdrawal,
        availableBalance,
      },
      breakdown: {
        fromChats,
        fromCalls,
        fromBookings,
      },
      periods,
      recentTransactions,
      activeSessions: activeSessions.map((s) => ({
        sessionId: s.id,
        type: s.type,
        totalCharged: s.totalCharged,
        durationSeconds: s.durationSeconds,
        clientName: s.client.clientProfile?.name ?? 'Client',
        clientId: s.clientId,
        startedAt: s.startedAt?.toISOString() ?? null,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        note: w.note,
        adminNote: w.adminNote,
        createdAt: w.createdAt,
        resolvedAt: w.resolvedAt,
      })),
    },
  });
}
