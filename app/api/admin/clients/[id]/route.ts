import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { sendClientApprovedEmail, sendClientRejectedEmail } from '@/lib/email';
import { recordAdminAction, AdminAction } from '@/lib/admin-audit';

export const runtime = 'nodejs';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().min(10, 'Please provide a reason (at least 10 characters)'),
  }),
  z.object({
    action: z.literal('request_info'),
    reason: z.string().min(10, 'Please specify what additional info is needed (at least 10 characters)'),
  }),
  z.object({ action: z.literal('approve_avatar') }),
  z.object({ action: z.literal('reject_avatar') }),
]);

// PATCH /api/admin/clients/[id] — approve or reject a client application
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request, ['ADMIN']);
  if (auth.user === null) return auth.response;

  const { id } = params;

  const body = await request.json();
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.user.findUnique({
      where: { id, role: 'CLIENT' },
      include: { clientProfile: { select: { name: true } } },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    const name = client.clientProfile?.name ?? 'there';

    if (parsed.data.action === 'approve') {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          clientStatus: 'APPROVED',
          adminApprovedAt: new Date(),
          rejectionReason: null,
        },
        select: {
          id: true,
          email: true,
          clientStatus: true,
          adminApprovedAt: true,
          clientProfile: { select: { name: true } },
        },
      });

      // Email is deferred — sent after the 8-hour companion review window.
      // The client shouldn't know about companion-side approvals, so the
      // approval email is only sent once full access is granted.

      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.CLIENT_APPROVE,
        targetType: 'User',
        targetId: id,
      });

      return NextResponse.json({ success: true, data: { client: updated } });
    }

    if (parsed.data.action === 'request_info') {
      const { reason } = parsed.data;

      // Keep status as PENDING_REVIEW but store the info request as rejectionReason
      // so the client/admin can see what's needed
      const updated = await prisma.user.update({
        where: { id },
        data: { rejectionReason: `[INFO REQUESTED] ${reason}` },
        select: {
          id: true,
          email: true,
          clientStatus: true,
          rejectionReason: true,
          clientProfile: { select: { name: true } },
        },
      });

      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.CLIENT_REJECT, // closest available action
        targetType: 'User',
        targetId: id,
        reason: `Info requested: ${reason}`,
      });

      return NextResponse.json({ success: true, data: { client: updated } });
    }

    if (parsed.data.action === 'approve_avatar') {
      await prisma.clientProfile.update({
        where: { userId: id },
        data: { avatarStatus: 'APPROVED' },
      });
      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.CLIENT_APPROVE,
        targetType: 'ClientProfile',
        targetId: id,
        reason: 'Avatar approved',
      });
      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === 'reject_avatar') {
      await prisma.clientProfile.update({
        where: { userId: id },
        data: { avatarStatus: 'REJECTED' },
      });
      await recordAdminAction({
        adminId: auth.user.id,
        action: AdminAction.CLIENT_REJECT,
        targetType: 'ClientProfile',
        targetId: id,
        reason: 'Avatar rejected',
      });
      return NextResponse.json({ success: true });
    }

    // action === 'reject'
    const { reason } = parsed.data;

    const updated = await prisma.user.update({
      where: { id },
      data: { clientStatus: 'REJECTED', rejectionReason: reason },
      select: {
        id: true,
        email: true,
        clientStatus: true,
        rejectionReason: true,
        clientProfile: { select: { name: true } },
      },
    });

    sendClientRejectedEmail(client.email, name, reason);

    await recordAdminAction({
      adminId: auth.user.id,
      action: AdminAction.CLIENT_REJECT,
      targetType: 'User',
      targetId: id,
      reason,
    });

    return NextResponse.json({ success: true, data: { client: updated } });
  } catch (error) {
    console.error('Admin client action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update client status' },
      { status: 500 }
    );
  }
}
