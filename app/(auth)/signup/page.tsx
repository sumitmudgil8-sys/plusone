'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { useToast } from '@/components/ui/Toast';

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    linkedInUrl: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy');
      toast.error('Please accept the terms to continue');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          linkedInUrl: form.linkedInUrl,
          dateOfBirth: form.dateOfBirth,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? 'Something went wrong';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Account created! Please upload your ID.');
      router.push('/client/verify');
    } catch {
      setError('Something went wrong. Please try again.');
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold/[0.04] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative animate-fade-in">
        {/* Logo area */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-bold text-gold-gradient tracking-tight">Plus One</h1>
          <p className="text-white/40 text-sm mt-2 tracking-wide">Create your account</p>
        </div>

        {/* Form card */}
        <div className="bg-charcoal-surface/80 border border-white/[0.06] rounded-2xl p-7 shadow-card backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Your full name"
              required
            />

            <Input
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={set('dateOfBirth')}
              required
            />

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="your@email.com"
              required
            />

            <Input
              label="Mobile Number"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="10-digit Indian mobile"
              required
            />

            <Input
              label="LinkedIn Profile URL"
              type="url"
              value={form.linkedInUrl}
              onChange={(e) => {
                let val = e.target.value.trim();
                // Auto-prepend https:// when user pastes a linkedin URL without protocol
                if (val && !val.startsWith('http://') && !val.startsWith('https://') && val.includes('linkedin.com')) {
                  val = 'https://' + val;
                }
                setForm((prev) => ({ ...prev, linkedInUrl: val }));
              }}
              placeholder="https://linkedin.com/in/yourprofile"
              required
            />

            <div>
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 8 characters"
                required
              />
              <PasswordStrength password={form.password} />
            </div>

            <Input
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Repeat your password"
              required
            />

            {/* Terms checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/[0.04] text-gold focus:ring-gold/30 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-gold hover:underline" target="_blank">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-gold hover:underline" target="_blank">
                  Privacy Policy
                </Link>
              </span>
            </label>

            {error && (
              <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Create Account
            </Button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center">
          <p className="text-white/35 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:text-gold-hover transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
