'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { UserTable } from '@/components/admin/UserTable';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

// ─── Types ───────────────────────────────────────────────────────
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
  clientProfile: {
    name: string | null;
    avatarUrl: string | null;
    dateOfBirth: string | null;
    govtIdUrl: string | null;
    additionalNotes: string | null;
  } | null;
}

// ─── Sub-tab definitions ─────────────────────────────────────────
type SubTab = 'clients' | 'companions' | 'all';

const SUB_TABS: { label: string; value: SubTab; icon: React.ReactNode }[] = [
  {
    label: 'Clients',
    value: 'clients',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Companions',
    value: 'companions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    label: 'All Users',
    value: 'all',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

// ─── Client status tabs ──────────────────────────────────────────
const CLIENT_TABS: { label: string; value: ClientStatus }[] = [
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

// ─── Main Page Component ─────────────────────────────────────────
export default function AdminUsersPage() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('clients');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-white/50 text-sm">Manage clients, companions, and all platform users</p>
      </div>

      {/* Sub-tab Switcher */}
      <div className="flex gap-1 bg-charcoal-surface border border-charcoal-border rounded-xl p-1.5">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveSubTab(tab.value)}
            className={cn(
              'flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeSubTab === tab.value
                ? 'bg-gold text-charcoal shadow-lg shadow-gold/20'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'clients' && <ClientsSection />}
      {activeSubTab === 'companions' && <CompanionsSection />}
      {activeSubTab === 'all' && <AllUsersSection />}
    </div>
  );
}

// ─── Clients Section ─────────────────────────────────────────────
function ClientsSection() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ClientStatus>('PENDING_REVIEW');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ clientId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [infoModal, setInfoModal] = useState<{ clientId: string; name: string } | null>(null);
  const [infoRequest, setInfoRequest] = useState('');
  const [govtIdModal, setGovtIdModal] = useState<string | null>(null);

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
        toast.success('Client approved');
        fetchClients(activeTab);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? 'Failed to approve client');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error — please try again');
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
        toast.success('Client rejected');
        setRejectModal(null);
        setRejectReason('');
        fetchClients(activeTab);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? 'Failed to reject client');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error — please try again');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfoConfirm = async () => {
    if (!infoModal || infoRequest.trim().length < 10) return;
    setActionLoading(infoModal.clientId);
    try {
      const res = await fetch(`/api/admin/clients/${infoModal.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_info', reason: infoRequest }),
      });
      if (res.ok) {
        toast.success('Info request sent');
        setInfoModal(null);
        setInfoRequest('');
        fetchClients(activeTab);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? 'Failed to request info');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error — please try again');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDob = (dob: string | null) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${d.toLocaleDateString('en-IN')} (${age}y)`;
  };

  return (
    <>
      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {CLIENT_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab.value
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'text-white/40 hover:text-white/70 border border-transparent hover:border-charcoal-border'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">No clients in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {clients.map((client) => {
              const name = client.clientProfile?.name ?? 'Unknown';
              const dob = formatDob(client.clientProfile?.dateOfBirth ?? null);

              return (
                <div key={client.id} className="py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-white">{name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[client.clientStatus]}`}>
                        {STATUS_LABELS[client.clientStatus]}
                      </span>
                    </div>
                    <p className="text-sm text-white/50">{client.email}</p>
                    {client.phone && <p className="text-xs text-white/40">{client.phone}</p>}
                    <div className="flex items-center gap-4 text-xs mt-1 flex-wrap">
                      {dob && <span className="text-white/50">DOB: {dob}</span>}
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
                      {client.clientProfile?.govtIdUrl && (
                        <button
                          onClick={() => setGovtIdModal(client.clientProfile!.govtIdUrl!)}
                          className="text-gold hover:underline"
                        >
                          View Govt ID
                        </button>
                      )}
                      <span className="text-white/30">
                        Applied {new Date(client.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    {client.rejectionReason && (
                      <p className="text-xs text-error/80 mt-1">Reason: {client.rejectionReason}</p>
                    )}
                    {client.clientProfile?.additionalNotes && (
                      <p className="text-xs text-gold/80 mt-1">Client notes: {client.clientProfile.additionalNotes}</p>
                    )}
                  </div>
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
                        onClick={() => setInfoModal({ clientId: client.id, name })}
                        disabled={actionLoading === client.id}
                        className="text-xs py-1.5 px-3"
                      >
                        Ask Info
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

      {/* Ask Info modal */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-white">Request Info from {infoModal.name}</h3>
            <p className="text-sm text-white/60">
              Specify what additional details are needed from this applicant.
            </p>
            <textarea
              value={infoRequest}
              onChange={(e) => setInfoRequest(e.target.value)}
              rows={4}
              placeholder="e.g. Please upload a clearer photo of your government ID — the text is not readable."
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {infoRequest.length > 0 && infoRequest.length < 10 && (
              <p className="text-xs text-error">Request must be at least 10 characters</p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setInfoModal(null); setInfoRequest(''); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestInfoConfirm}
                isLoading={actionLoading === infoModal.clientId}
                disabled={infoRequest.trim().length < 10}
                className="flex-1"
              >
                Send Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Govt ID viewer modal */}
      {govtIdModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setGovtIdModal(null)}
        >
          <div
            className="bg-charcoal-surface border border-charcoal-border rounded-xl p-4 max-w-lg w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Government ID</h3>
              <button onClick={() => setGovtIdModal(null)} className="text-white/40 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {govtIdModal.endsWith('.pdf') ? (
              <div className="text-center py-8">
                <a
                  href={govtIdModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline"
                >
                  Open PDF in new tab ↗
                </a>
              </div>
            ) : (
              <img
                src={govtIdModal}
                alt="Government ID"
                className="w-full rounded-lg border border-white/10"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Companions Section ──────────────────────────────────────────
function CompanionsSection() {
  const [companions, setCompanions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    hourlyRate: 2000,
    chatRatePerMinute: 0,
    callRatePerMinute: 0,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCompanions();
  }, []);

  const fetchCompanions = async () => {
    try {
      const res = await fetch('/api/admin/companions');
      const data = await res.json();
      setCompanions(data.companions);
    } catch (error) {
      console.error('Error fetching companions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/companions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setNewPassword(data.tempPassword);
        setShowCreateModal(false);
        setShowPasswordModal(true);
        setFormData({ email: '', name: '', password: '', hourlyRate: 2000, chatRatePerMinute: 0, callRatePerMinute: 0 });
        fetchCompanions();
      }
    } catch (error) {
      console.error('Error creating companion:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch('/api/admin/companions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isApproved }),
      });
      if (res.ok) fetchCompanions();
    } catch (error) {
      console.error('Error approving companion:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/companions?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        fetchCompanions();
      }
    } catch (error) {
      console.error('Error deleting companion:', error);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Companion
        </Button>
      </div>

      <Card>
        {companions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">No companions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Booking</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Chat</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Call</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-border">
                {(companions as any[]).map((companion: any) => (
                  <tr key={companion.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {companion.companionProfile?.avatarUrl ? (
                          <img
                            src={companion.companionProfile.avatarUrl}
                            alt={companion.companionProfile.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-white font-medium">
                            {companion.companionProfile?.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-white">{companion.companionProfile?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white/70">{companion.email}</td>
                    <td className="py-3 px-4 text-white text-sm">
                      ₹{Math.round((companion.companionProfile?.hourlyRate ?? 0) / 100)}/hr
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {companion.companionProfile?.chatRatePerMinute
                        ? `₹${Math.round(companion.companionProfile.chatRatePerMinute / 100)}/min`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-white text-sm">
                      {companion.companionProfile?.callRatePerMinute
                        ? `₹${Math.round(companion.companionProfile.callRatePerMinute / 100)}/min`
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={companion.companionProfile?.isApproved ? 'success' : 'warning'}>
                        {companion.companionProfile?.isApproved ? 'Approved' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleApprove(companion.id, !companion.companionProfile?.isApproved)
                          }
                        >
                          {companion.companionProfile?.isApproved ? 'Reject' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget({ id: companion.id, name: companion.companionProfile?.name ?? 'this companion' })}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Companion Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Companion Account"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 6 chars (leave blank to auto-generate)"
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30"
            />
            <p className="text-xs text-white/40 mt-1">Companion must change this on first login</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Booking (₹/hr)</label>
              <input
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: parseInt(e.target.value) || 0 })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Chat (₹/min)</label>
              <input
                type="number"
                value={formData.chatRatePerMinute}
                onChange={(e) => setFormData({ ...formData, chatRatePerMinute: parseInt(e.target.value) || 0 })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Call (₹/min)</label>
              <input
                type="number"
                value={formData.callRatePerMinute}
                onChange={(e) => setFormData({ ...formData, callRatePerMinute: parseInt(e.target.value) || 0 })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" isLoading={creating}>
            Create Account
          </Button>
        </form>
      </Modal>

      {/* Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Account Created"
      >
        <div className="space-y-4">
          <div className="p-4 bg-gold/10 border border-gold/30 rounded-lg">
            <p className="text-sm text-white/60 mb-2">Temporary password:</p>
            <code className="text-lg font-mono text-gold">{newPassword}</code>
          </div>
          <p className="text-sm text-white/60">
            Please share this password securely with the companion. They should change it after first login.
          </p>
          <Button onClick={() => setShowPasswordModal(false)} className="w-full">
            Done
          </Button>
        </div>
      </Modal>

      {/* Delete Companion Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete companion?"
        message={`This will permanently delete ${deleteTarget?.name ?? 'this companion'} and all their data. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        busy={deleteBusy}
      />
    </>
  );
}

// ─── All Users Section ───────────────────────────────────────────
function AllUsersSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (id: string, isBanned: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isBanned }),
      });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleUpgradeUser = async (id: string, tier: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, subscriptionTier: tier }),
      });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Error upgrading user:', error);
    }
  };

  const handleApproveCompanion = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch('/api/admin/companions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isApproved }),
      });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Error approving companion:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Card>
      <UserTable
        users={users}
        onBanUser={handleBanUser}
        onDeleteUser={handleDeleteUser}
        onUpgradeUser={handleUpgradeUser}
        onApproveCompanion={handleApproveCompanion}
      />
    </Card>
  );
}
