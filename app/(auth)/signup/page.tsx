'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    linkedInUrl: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
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
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      router.push('/apply/submitted');
    } catch {
      setError('Something went wrong. Please try again.');
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
          <p className="text-white/40 text-sm mt-2 tracking-wide">Apply for membership</p>
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
              onChange={set('linkedInUrl')}
              placeholder="https://linkedin.com/in/yourprofile"
              required
            />

            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="At least 8 characters"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Repeat your password"
              required
            />

            {error && (
              <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Submit Application
            </Button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-white/35 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:text-gold-hover transition-colors">
              Sign in
            </Link>
          </p>
          <p className="text-white/25 text-xs">
            Want to work as a companion?{' '}
            <Link href="/companion-signup" className="text-gold/70 hover:text-gold transition-colors">
              Apply here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
