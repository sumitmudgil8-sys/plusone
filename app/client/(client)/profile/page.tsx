"use client";
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SUBSCRIPTION_PRICE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
  });

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setFormData({
          name: data.user.clientProfile?.name || '',
          bio: data.user.clientProfile?.bio || '',
          avatarUrl: data.user.clientProfile?.avatarUrl || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/subscription/upgrade', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setShowUpgradeModal(false);
      }
    } catch (error) {
      console.error('Error upgrading:', error);
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const isPremium = user?.subscriptionTier === 'PREMIUM';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/60">Manage your account</p>
      </div>

      {/* Subscription Card */}
      <Card
        className={`
          ${isPremium ? 'bg-gold/10 border-gold/30' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">Subscription</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isPremium ? 'gold' : 'outline'}>
                {user?.subscriptionTier || 'FREE'}
              </Badge>
              {isPremium && (
                <span className="text-sm text-gold">✓ Premium Member</span>
              )}
            </div>
          </div>

          {!isPremium && (
            <Button onClick={() => setShowUpgradeModal(true)}>
              Upgrade
            </Button>
          )}
        </div>

        {!isPremium && (
          <div className="mt-4 pt-4 border-t border-charcoal-border">
            <p className="text-sm text-white/60 mb-3">Premium Benefits:</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li>✓ Unlimited companion browsing</li>
              <li>✓ Unlimited messages</li>
              <li>✓ Priority booking requests</li>
            </ul>
          </div>
        )}
      </Card>

      {/* Profile Form */}
      <Card>
        <h2 className="font-medium text-white mb-4">Personal Information</h2>
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="Tell us about yourself..."
            />
          </div>

          <Input
            label="Avatar URL"
            value={formData.avatarUrl}
            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
            placeholder="https://example.com/avatar.jpg"
          />

          {formData.avatarUrl && (
            <div className="mt-2">
              <p className="text-sm text-white/60 mb-2">Preview:</p>
              <img
                src={formData.avatarUrl}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <Button
          className="w-full mt-6"
          isLoading={saving}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </Card>

      {/* Account Info */}
      <Card>
        <h2 className="font-medium text-white mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Email</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Member Since</span>
            <span className="text-white">
              {new Date(user?.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Upgrade Modal */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to Premium"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>

          <h3 className="text-lg font-medium text-white">Unlock Premium</h3>

          <p className="text-white/60">
            Get unlimited access to all companions and messaging
          </p>

          <div className="text-3xl font-bold text-gold">
            {formatCurrency(SUBSCRIPTION_PRICE)}
            <span className="text-lg font-normal text-white/50"> / one-time</span>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpgrade}
              isLoading={upgrading}
              className="flex-1"
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
