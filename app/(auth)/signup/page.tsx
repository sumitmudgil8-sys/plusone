'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

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
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gold mb-2">Plus One</h1>
          <p className="text-white/60">Apply for membership</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Submit Application
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/60 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal-border">
          <p className="text-xs text-white/40 text-center">
            Want to work as a companion?{' '}
            <Link href="/companion-signup" className="text-gold hover:underline">
              Apply here
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
