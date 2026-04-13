'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PasswordStrength } from '@/components/ui/PasswordStrength';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-charcoal flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'Something went wrong';
        setError(msg);
        toast.error(msg);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gold/[0.02] rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative animate-fade-in">
        {/* Logo area */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-bold text-gold-gradient tracking-tight">Plus One</h1>
          <p className="text-white/40 text-sm mt-2 tracking-wide">Set new password</p>
        </div>

        {/* Form card */}
        <div className="bg-charcoal-surface/80 border border-white/[0.06] rounded-2xl p-7 shadow-card backdrop-blur-sm">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Your password has been reset successfully.
              </p>
              <Link
                href="/login"
                className="inline-block text-gold hover:text-gold-hover transition-colors text-sm font-medium"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Input
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                <PasswordStrength password={password} />
              </div>

              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />

              {error && (
                <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                Reset Password
              </Button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center">
          <p className="text-white/35 text-sm">
            Remember your password?{' '}
            <Link href="/login" className="text-gold hover:text-gold-hover transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
