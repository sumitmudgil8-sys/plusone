'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  SUBSCRIPTION_PRICE,
  WALLET_MIN_RECHARGE,
  WALLET_MAX_RECHARGE,
  WALLET_RECHARGE_PRESETS,
  RAZORPAY_CONFIG,
} from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
}

interface UserData {
  id: string;
  email: string;
  createdAt: string;
  subscriptionTier: string;
  clientProfile: {
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
  } | null;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
  });

  useEffect(() => {
    fetchUser();
    fetchWallet();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setFormData({
          name: data.user.clientProfile?.name ?? '',
          bio: data.user.clientProfile?.bio ?? '',
          avatarUrl: data.user.clientProfile?.avatarUrl ?? '',
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet(data.data);
      }
    } catch {
      // wallet fetch is non-fatal
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

  const handleRecharge = async () => {
    const amount = customAmount ? parseInt(customAmount, 10) : rechargeAmount;
    if (!amount || amount < WALLET_MIN_RECHARGE || amount > WALLET_MAX_RECHARGE) {
      setRechargeError(
        `Amount must be between ${formatCurrency(WALLET_MIN_RECHARGE)} and ${formatCurrency(WALLET_MAX_RECHARGE)}`
      );
      return;
    }

    setRecharging(true);
    setRechargeError('');

    try {
      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load payment SDK'));
          document.body.appendChild(script);
        });
      }

      const res = await fetch('/api/wallet/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRechargeError(data.error ?? 'Failed to create order');
        return;
      }

      const { orderId, amount: orderAmount, currency, keyId } = data.data as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      const rzp = new window.Razorpay({
        key: keyId,
        amount: orderAmount,
        currency,
        name: RAZORPAY_CONFIG.name,
        description: 'Wallet Recharge',
        order_id: orderId,
        handler: async (response: unknown) => {
          const r = response as {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          };
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            }),
          });
          if (verifyRes.ok) {
            setShowRechargeModal(false);
            setCustomAmount('');
            setRechargeAmount(500);
            fetchWallet();
          } else {
            setRechargeError('Payment verification failed');
          }
        },
        theme: RAZORPAY_CONFIG.theme,
      });

      rzp.open();
      rzp.on('payment.failed', () => {
        setRechargeError('Payment failed. Please try again.');
      });
    } catch (err) {
      setRechargeError(err instanceof Error ? err.message : 'Payment initialization failed');
    } finally {
      setRecharging(false);
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

      {/* Wallet Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-white">Wallet Balance</h2>
            <p className="text-3xl font-bold text-gold mt-1">
              {wallet ? formatCurrency(wallet.balance) : '—'}
            </p>
          </div>
          <Button onClick={() => { setShowRechargeModal(true); setRechargeError(''); }}>
            Add Money
          </Button>
        </div>

        {wallet && wallet.transactions.length > 0 && (
          <div className="border-t border-charcoal-border pt-4">
            <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Recent Transactions</p>
            <div className="space-y-2">
              {wallet.transactions.slice(0, 3).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70 truncate max-w-[200px]">{tx.description}</span>
                  <span
                    className={
                      tx.type === 'CREDIT' || tx.type === 'RECHARGE'
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    {tx.type === 'CREDIT' || tx.type === 'RECHARGE' ? '+' : '-'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Subscription Card */}
      <Card className={isPremium ? 'bg-gold/10 border-gold/30' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">Subscription</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isPremium ? 'gold' : 'outline'}>
                {user?.subscriptionTier ?? 'FREE'}
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
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* Wallet Recharge Modal */}
      <Modal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        title="Add Money to Wallet"
        size="sm"
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm text-white/60 mb-3">Select amount</p>
            <div className="grid grid-cols-3 gap-2">
              {WALLET_RECHARGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setRechargeAmount(preset); setCustomAmount(''); }}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    rechargeAmount === preset && !customAmount
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-charcoal-border text-white/70 hover:border-white/30'
                  }`}
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Or enter custom amount (₹)</label>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setRechargeAmount(0); }}
              placeholder={`${WALLET_MIN_RECHARGE} – ${WALLET_MAX_RECHARGE}`}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold"
              min={WALLET_MIN_RECHARGE}
              max={WALLET_MAX_RECHARGE}
            />
          </div>

          {rechargeError && (
            <p className="text-sm text-red-400">{rechargeError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => setShowRechargeModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecharge}
              isLoading={recharging}
              className="flex-1"
            >
              Pay {formatCurrency(customAmount ? parseInt(customAmount, 10) || 0 : rechargeAmount)}
            </Button>
          </div>
        </div>
      </Modal>

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
