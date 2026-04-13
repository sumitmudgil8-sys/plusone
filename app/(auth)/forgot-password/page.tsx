'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'Something went wrong';
        setError(msg);
        toast.error(msg);
        return;
      }

      setSent(true);
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
          <p className="text-white/40 text-sm mt-2 tracking-wide">Reset your password</p>
        </div>

        {/* Form card */}
        <div className="bg-charcoal-surface/80 border border-white/[0.06] rounded-2xl p-7 shadow-card backdrop-blur-sm">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Check your email for a reset link. It expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-white/50 text-sm leading-relaxed">
                Enter your email and we&apos;ll send you a reset link
              </p>

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />

              {error && (
                <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                Send Reset Link
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
