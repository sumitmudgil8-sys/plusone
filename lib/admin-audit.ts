import { prisma } from '@/lib/prisma';

/**
 * Append a row to AdminAuditLog. Call this from every admin mutation
 * endpoint so there's a permanent record of who changed what.
 *
 * Intentionally swallows write errors (logged to console) so an audit-log
 * outage cannot block a legitimate admin action. If audit is business-
 * critical, wrap the caller in a transaction instead.
 */
export async function recordAdminAction(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        metadata: JSON.stringify(params.metadata ?? {}),
      },
    });
  } catch (err) {
    // Do NOT throw — audit logging must never break an admin operation.
    console.error('[admin-audit] Failed to record action:', err, params);
  }
}

/**
 * Canonical action strings. Keep adding to this list as new admin
 * endpoints grow audit-worthy mutations.
 */
export const AdminAction = {
  USER_BAN: 'USER_BAN',
  USER_UNBAN: 'USER_UNBAN',
  USER_DELETE: 'USER_DELETE',
  CLIENT_APPROVE: 'CLIENT_APPROVE',
  CLIENT_REJECT: 'CLIENT_REJECT',
  COMPANION_APPROVE: 'COMPANION_APPROVE',
  COMPANION_REJECT: 'COMPANION_REJECT',
  COMPANION_UPDATE: 'COMPANION_UPDATE',
  PAYMENT_APPROVE: 'PAYMENT_APPROVE',
  PAYMENT_REJECT: 'PAYMENT_REJECT',
  WITHDRAWAL_APPROVE: 'WITHDRAWAL_APPROVE',
  WITHDRAWAL_REJECT: 'WITHDRAWAL_REJECT',
  WITHDRAWAL_PAY: 'WITHDRAWAL_PAY',
  VERIFICATION_APPROVE: 'VERIFICATION_APPROVE',
  VERIFICATION_REJECT: 'VERIFICATION_REJECT',
} as const;

export type AdminActionType = typeof AdminAction[keyof typeof AdminAction];
