'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type ClientStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

interface Client {
  id: string;
  email: string;
  phone: string | null;
  linkedInUrl: string | null;
  clientStatus: ClientStatus;
  setuOkycRefId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  clientProfile: { name: string | null; avatarUrl: string | null } | null;
}

const TABS: { label: string; value: ClientStatus | 'ALL' }[] = [
  { label: 'Pending', value: 'PENDING_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const STATUS_COLORS: Record<ClientStatus, string> = {
  PENDING_REVIEW: 'text-gold bg-gold/10',
  APPROVED: 'text-green-400 bg-green-400/10',
  REJECTED: 'text-error bg-error/10',
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  PENDING_REVIEW: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default function AdminClientsPage() {
  const [activeTab, setActiveTab] = useState<ClientStatus>('PENDING_REVIEW');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ clientId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchClients = useCallback(async (status: ClientStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients?status=${status}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.data?.clients ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients(activeTab);
  }, [activeTab, fetchClients]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        fetchClients(activeTab);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal || rejectReason.trim().length < 10) return;
    setActionLoading(rejectModal.clientId);
    try {
      const res = await fetch(`/api/admin/clients/${rejectModal.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      });
      if (res.ok) {
        setRejectModal(null);
        setRejectReason('');
        fetchClients(activeTab);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const okycLabel = (refId: string | null) => {
    if (!refId) return { text: 'Not started', cls: 'text-white/30' };
    if (refId.endsWith(':verified')) return { text: 'Verified ✓', cls: 'text-green-400' };
    return { text: 'Initiated', cls: 'text-gold' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Client Applications</h1>
        <p className="text-white/60">Review and approve client membership requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as ClientStatus)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-gold text-charcoal'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-center text-white/40 py-12 text-sm">No clients in this category</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {clients.map((client) => {
              const name = client.clientProfile?.name ?? 'Unknown';
              const okyc = okycLabel(client.setuOkycRefId);

              return (
                <div key={client.id} className="py-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">{name[0]}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[client.clientStatus]}`}>
                        {STATUS_LABELS[client.clientStatus]}
                      </span>
                    </div>
                    <p className="text-sm text-white/50">{client.email}</p>
                    {client.phone && (
                      <p className="text-xs text-white/40">{client.phone}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs mt-1 flex-wrap">
                      {client.linkedInUrl && (
                        <a
                          href={client.linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:underline"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                      <span className={okyc.cls}>OKYC: {okyc.text}</span>
                      <span className="text-white/30">
                        Applied {new Date(client.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    {client.rejectionReason && (
                      <p className="text-xs text-error/80 mt-1">
                        Reason: {client.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {client.clientStatus === 'PENDING_REVIEW' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        onClick={() => handleApprove(client.id)}
                        isLoading={actionLoading === client.id}
                        className="text-xs py-1.5 px-3"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setRejectModal({ clientId: client.id, name })}
                        disabled={actionLoading === client.id}
                        className="text-xs py-1.5 px-3"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-white">Reject {rejectModal.name}&apos;s Application</h3>
            <p className="text-sm text-white/60">
              Provide a reason. This will be included in the rejection email.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. LinkedIn profile could not be verified. Please re-apply with an updated profile link."
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {rejectReason.length > 0 && rejectReason.length < 10 && (
              <p className="text-xs text-error">Reason must be at least 10 characters</p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectConfirm}
                isLoading={actionLoading === rejectModal.clientId}
                disabled={rejectReason.trim().length < 10}
                className="flex-1"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
