'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useLocation } from '@/hooks/useLocation';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-charcoal flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-[#C9A96E] border-t-transparent rounded-full" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateLocation } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isManualLogout = searchParams.get('logged_out') === '1';
  const [restoring, setRestoring] = useState(!isManualLogout);

  // Auto-restore session from localStorage refresh token
  useEffect(() => {
    if (isManualLogout) { setRestoring(false); return; }
    const rt = localStorage.getItem('_pone_rt');
    if (!rt) { setRestoring(false); return; }

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user?.role) {
          if (d.refreshToken) localStorage.setItem('_pone_rt', d.refreshToken);
          switch (d.user.role) {
            case 'CLIENT':    router.replace('/client/dashboard');    break;
            case 'COMPANION': router.replace('/companion/dashboard'); break;
            case 'ADMIN':     router.replace('/admin/dashboard');     break;
          }
        } else {
          localStorage.removeItem('_pone_rt');
          setRestoring(false);
        }
      })
      .catch(() => { setRestoring(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      // Companions with a temporary password must change it first
      if (data.user.role === 'COMPANION' && data.user.isTemporaryPassword) {
        router.push('/companion/change-password');
        return;
      }

      // Save refresh token to localStorage so the session can be silently
      // restored if Android/Samsung clears the httpOnly cookie.
      try {
        const sessionRes = await fetch('/api/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.refreshToken) {
            localStorage.setItem('_pone_rt', sessionData.refreshToken);
          }
        }
      } catch { /* non-fatal — auth still works via cookie */ }

      // Best-effort location update after login — never blocks redirect
      updateLocation();

      // Redirect based on role
      switch (data.user.role) {
        case 'CLIENT':
          router.push('/client/dashboard');
          break;
        case 'COMPANION':
          router.push('/companion/dashboard');
          break;
        case 'ADMIN':
          router.push('/admin/dashboard');
          break;
        default:
          router.push('/');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A96E] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gold mb-2">Plus One</h1>
          <p className="text-white/60">Welcome back</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/60">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-gold hover:underline">
              Sign up
            </Link>
          </p>
        </div>

      </Card>
    </div>
  );
}
