'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// This page is reached via middleware redirect when isTemporaryPassword === true
// and the companion tries to navigate anywhere in /companion/*.
// After success the layout's needsPasswordChange state is irrelevant here —
// a fresh navigation to /companion/dashboard re-mounts the layout which
// re-fetches the user and sees isTemporaryPassword === false.

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to update password');
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
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#2A2A2A] border border-[#3A3A3A] rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Set Your Password</h2>
          <p className="text-sm text-white/50 mt-1">
            You must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Current Password</label>
            <input
              name="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Enter your temporary password"
              required
              autoFocus
              className="w-full bg-[#1C1C1C] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
            <input
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="At least 8 characters"
              required
              className="w-full bg-[#1C1C1C] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm New Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat new password"
              required
              className="w-full bg-[#1C1C1C] border border-[#3A3A3A] text-white rounded-lg px-4 py-2.5 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
