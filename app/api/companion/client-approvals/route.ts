import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET  — Fetch clients for this companion's review queue.
 *        ?status=PENDING  → clients with NO visibility row (not yet reviewed)
 *        ?status=APPROVED → clients explicitly approved
 *        ?status=REJECTED → clients explicitly rejected
 *
 * POST — Approve or reject a specific client.
 *        Body: { clientId: string, action: 'APPROVED' | 'REJECTED' }
 *
 * Visibility rows are created ONLY when the companion takes action (approve /
 * reject). No bulk lazy-population — this avoids breaking existing browse
 * visibility for clients who were already on the platform.
 *
 * Browse-side semantics (enforced in /api/companions):
 *   visible = no row exists  OR  row.status === 'APPROVED'
 *   hidden  = row.status === 'REJECTED'
 */

export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const companionId = auth.user.id;
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('status') || 'PENDING';

  try {
    // All client IDs this companion has already reviewed (approved or rejected)
    const existingRows = await prisma.clientVisibility.findMany({
      where: { companionId },
      select: { clientId: true, status: true },
    });
    const reviewedIds = existingRows.map((r) => r.clientId);
    let approvedCount = 0;
    let rejectedCount = 0;
    for (const r of existingRows) {
      if (r.status === 'APPROVED') approvedCount++;
      else if (r.status === 'REJECTED') rejectedCount++;
    }

    if (filter === 'PENDING') {
      // "Pending" = approved-by-admin clients who have NO visibility row for
      // this companion (not yet reviewed). We query the User table directly.
      const unreviewed = await prisma.user.findMany({
        where: {
          role: 'CLIENT',
          isActive: true,
          isBanned: false,
          clientStatus: 'APPROVED',
          ...(reviewedIds.length > 0 ? { id: { notIn: reviewedIds } } : {}),
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          clientProfile: {
            select: {
              name: true,
              bio: true,
              avatarUrl: true,
              occupation: true,
              city: true,
              dateOfBirth: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const clients = unreviewed.map((u) => ({
        visibilityId: '',
        clientId: u.id,
        status: 'PENDING',
        name: u.clientProfile?.name || u.email.split('@')[0],
        bio: u.clientProfile?.bio || null,
        avatarUrl: u.clientProfile?.avatarUrl || null,
        occupation: u.clientProfile?.occupation || null,
        city: u.clientProfile?.city || null,
        dateOfBirth: u.clientProfile?.dateOfBirth || null,
        joinedAt: u.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data: {
          clients,
          counts: {
            pending: clients.length,
            approved: approvedCount,
            rejected: rejectedCount,
          },
        },
      });
    }

    // APPROVED or REJECTED — fetch from existing visibility rows
    const rows = await prisma.clientVisibility.findMany({
      where: { companionId, status: filter },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            clientProfile: {
              select: {
                name: true,
                bio: true,
                avatarUrl: true,
                occupation: true,
                city: true,
                dateOfBirth: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const clients = rows.map((r) => ({
      visibilityId: r.id,
      clientId: r.clientId,
      status: r.status,
      name: r.client.clientProfile?.name || r.client.email.split('@')[0],
      bio: r.client.clientProfile?.bio || null,
      avatarUrl: r.client.clientProfile?.avatarUrl || null,
      occupation: r.client.clientProfile?.occupation || null,
      city: r.client.clientProfile?.city || null,
      dateOfBirth: r.client.clientProfile?.dateOfBirth || null,
      joinedAt: r.client.createdAt,
    }));

    // For the pending count when viewing APPROVED/REJECTED tab, we need to
    // count unreviewed clients without fetching all their data.
    const totalApprovedClients = await prisma.user.count({
      where: {
        role: 'CLIENT',
        isActive: true,
        isBanned: false,
        clientStatus: 'APPROVED',
      },
    });
    const pendingCount = totalApprovedClients - reviewedIds.length;

    return NextResponse.json({
      success: true,
      data: {
        clients,
        counts: {
          pending: Math.max(0, pendingCount),
          approved: approvedCount,
          rejected: rejectedCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching client approvals:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const companionId = auth.user.id;

  try {
    const body = await request.json();
    const { clientId, action } = body as { clientId?: string; action?: string };

    if (!clientId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'clientId and action (APPROVED|REJECTED) are required' },
        { status: 400 }
      );
    }

    // Upsert — creates the row on first action, updates on subsequent changes
    await prisma.clientVisibility.upsert({
      where: { companionId_clientId: { companionId, clientId } },
      update: { status: action },
      create: { companionId, clientId, status: action },
    });

    return NextResponse.json({ success: true, data: { clientId, status: action } });
  } catch (error) {
    console.error('Error updating client visibility:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}
