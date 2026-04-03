'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to change password');
        return;
      }

      router.replace('/companion/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
          <p className="text-white/60 mt-2 text-sm">
            You must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Current Password"
            name="currentPassword"
            type="password"
            value={formData.currentPassword}
            onChange={handleChange}
            placeholder="Enter temporary password"
            required
          />

          <Input
            label="New Password"
            name="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={handleChange}
            placeholder="At least 8 characters"
            required
          />

          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Repeat new password"
            required
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Set Password & Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
