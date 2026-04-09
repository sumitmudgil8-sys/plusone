"use client";
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export default function AdminCompanionsPage() {
  const [companions, setCompanions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
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

      if (res.ok) {
        fetchCompanions();
      }
    } catch (error) {
      console.error('Error approving companion:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const res = await fetch(`/api/admin/companions?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchCompanions();
      }
    } catch (error) {
      console.error('Error deleting companion:', error);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Companions</h1>
          <p className="text-white/60">Manage companion accounts</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Create Companion
        </Button>
      </div>

      <Card>
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
                <tr key={companion.id}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {companion.companionProfile?.avatarUrl ? (
                        <img
                          src={companion.companionProfile.avatarUrl}
                          alt={companion.companionProfile.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center text-white font-medium">
                          {companion.companionProfile?.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-white">{companion.companionProfile?.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white/70">{companion.email}</td>
                  <td className="py-3 px-4 text-white text-sm">₹{Math.round((companion.companionProfile?.hourlyRate ?? 0) / 100)}/hr</td>
                  <td className="py-3 px-4 text-white text-sm">{companion.companionProfile?.chatRatePerMinute ? `₹${Math.round(companion.companionProfile.chatRatePerMinute / 100)}/min` : '—'}</td>
                  <td className="py-3 px-4 text-white text-sm">{companion.companionProfile?.callRatePerMinute ? `₹${Math.round(companion.companionProfile.callRatePerMinute / 100)}/min` : '—'}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={companion.companionProfile?.isApproved ? 'success' : 'warning'}
                    >
                      {companion.companionProfile?.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleApprove(
                            companion.id,
                            !companion.companionProfile?.isApproved
                          )
                        }
                      >
                        {companion.companionProfile?.isApproved ? 'Reject' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(companion.id)}
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
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Password
            </label>
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
            Please share this password securely with the companion.
            They should change it after first login.
          </p>
          <Button onClick={() => setShowPasswordModal(false)} className="w-full">
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
