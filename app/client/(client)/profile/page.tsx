'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';

interface UserData {
  id: string;
  email: string;
  phone: string | null;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  clientProfile: {
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    city: string | null;
    occupation: string | null;
  } | null;
}

interface WalletData {
  balance: number;
  transactions: { id: string; type: string; amount: number; description: string; createdAt: string }[];
}

interface SubscriptionData {
  status: string;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal info form
  const [infoForm, setInfoForm] = useState({ name: '', phone: '', city: '', occupation: '', bio: '' });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Avatar upload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [userRes, walletRes, subRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/wallet'),
        fetch('/api/subscription/status'),
      ]);

      if (userRes.ok) {
        const d = await userRes.json();
        const u: UserData = d.user;
        setUser(u);
        setAvatarUrl(u.clientProfile?.avatarUrl ?? null);
        setInfoForm({
          name: u.clientProfile?.name ?? '',
          phone: u.phone ?? '',
          city: u.clientProfile?.city ?? '',
          occupation: u.clientProfile?.occupation ?? '',
          bio: u.clientProfile?.bio ?? '',
        });
      }
      if (walletRes.ok) {
        const d = await walletRes.json();
        setWallet(d.data);
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSubscription(d.data ?? d);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'avatar');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setAvatarUrl(data.data.url);
      }
    } catch {
      // non-fatal
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleInfoSave = async () => {
    setInfoSaving(true);
    setInfoMsg('');
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: infoForm.name,
          phone: infoForm.phone,
          city: infoForm.city,
          occupation: infoForm.occupation,
          bio: infoForm.bio,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInfoMsg('Saved');
        setTimeout(() => setInfoMsg(''), 2000);
      } else {
        setInfoMsg(data.error ?? 'Failed to save');
      }
    } catch {
      setInfoMsg('Failed to save');
    } finally {
      setInfoSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const isSubscribed = subscription?.status === 'ACTIVE';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/60">Manage your account</p>
      </div>

      {/* Avatar + Personal Info */}
      <Card>
        <h2 className="font-medium text-white mb-5">Personal Information</h2>

        {/* Circular avatar upload */}
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={handleAvatarClick}
            className="relative shrink-0 w-20 h-20 rounded-full overflow-hidden bg-white/[0.08] border-2 border-white/[0.06] hover:border-gold/40 transition-colors group"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-white/30">
                {infoForm.name?.charAt(0) || user?.email?.charAt(0) || '?'}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {avatarUploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div>
            <p className="text-sm text-white font-medium">Profile photo</p>
            <p className="text-xs text-white/40 mt-0.5">Click to upload · JPG, PNG up to 5 MB</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Name"
            value={infoForm.name}
            onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your display name"
          />
          <Input
            label="Phone"
            value={infoForm.phone}
            onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="10-digit mobile number"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={infoForm.city}
              onChange={(e) => setInfoForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="e.g. Mumbai"
            />
            <Input
              label="Occupation"
              value={infoForm.occupation}
              onChange={(e) => setInfoForm((f) => ({ ...f, occupation: e.target.value }))}
              placeholder="e.g. Engineer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Bio
              <span className="text-white/30 ml-2">{infoForm.bio.length}/300</span>
            </label>
            <textarea
              value={infoForm.bio}
              onChange={(e) => setInfoForm((f) => ({ ...f, bio: e.target.value.slice(0, 300) }))}
              rows={3}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold text-sm"
              placeholder="A short bio about yourself..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <Button onClick={handleInfoSave} isLoading={infoSaving}>
            Save Changes
          </Button>
          {infoMsg && (
            <span className={`text-sm ${infoMsg === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
              {infoMsg}
            </span>
          )}
        </div>
      </Card>

      {/* Subscription Status */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-white">Subscription</h2>
          <Badge variant={isSubscribed ? 'gold' : 'outline'}>
            {isSubscribed ? 'Active' : 'Free'}
          </Badge>
        </div>
        {isSubscribed && subscription?.subscriptionExpiresAt ? (
          <div className="space-y-1.5">
            <p className="text-sm text-white/60">
              Access until{' '}
              <span className="text-white">
                {new Date(subscription.subscriptionExpiresAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
            {subscription.daysRemaining !== null && (
              <p className="text-xs text-white/40">
                {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/55">Unlock all companions for ₹2,999/month</p>
            <a href="/client/subscription" className="text-xs text-gold font-semibold hover:underline whitespace-nowrap ml-3">
              Subscribe →
            </a>
          </div>
        )}
      </Card>

      {/* Wallet */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium text-white">Wallet Balance</h2>
          <p className="text-2xl font-bold text-gold">
            {wallet ? formatCurrency(wallet.balance) : '—'}
          </p>
        </div>
        <p className="text-xs text-white/40 mb-4">Used for per-minute chat &amp; call billing</p>

        {wallet && wallet.transactions.length > 0 && (
          <div className="border-t border-charcoal-border pt-3">
            <p className="text-xs text-white/40 mb-2 uppercase tracking-wide">Recent</p>
            <div className="space-y-2">
              {wallet.transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60 truncate max-w-[200px]">{tx.description}</span>
                  <span className={tx.type === 'CREDIT' || tx.type === 'RECHARGE' ? 'text-green-400' : 'text-red-400'}>
                    {tx.type === 'CREDIT' || tx.type === 'RECHARGE' ? '+' : '-'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Account Info */}
      <Card>
        <h2 className="font-medium text-white mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Email</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Member Since</span>
            <span className="text-white">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* Legal links */}
      <div className="flex justify-center gap-6 text-xs text-white/30 pb-4">
        <a href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</a>
        <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</a>
        <a href="/refund-policy" className="hover:text-white/60 transition-colors">Refund Policy</a>
      </div>
    </div>
  );
}
