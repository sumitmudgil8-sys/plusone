'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useLocation } from '@/hooks/useLocation';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-charcoal flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
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
  const toast = useToast();
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
            case 'CLIENT':
              if (d.user.clientStatus === 'PENDING_REVIEW') {
                router.replace('/client/pending');
              } else if (d.user.clientStatus === 'REJECTED') {
                router.replace('/client/rejected');
              } else {
                router.replace('/client/dashboard');
              }
              break;
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
        const msg = data.error || 'Invalid credentials';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Welcome back');

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

      // Redirect based on role (and approval status for clients)
      switch (data.user.role) {
        case 'CLIENT':
          if (data.user.clientStatus === 'PENDING_REVIEW') {
            router.push('/client/pending');
          } else if (data.user.clientStatus === 'REJECTED') {
            router.push('/client/rejected');
          } else {
            router.push('/client/dashboard');
          }
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
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gold/[0.02] rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative animate-fade-in">
        {/* Logo area */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-bold text-gold-gradient tracking-tight">Plus One</h1>
          <p className="text-white/40 text-sm mt-2 tracking-wide">Welcome back</p>
        </div>

        {/* Form card */}
        <div className="bg-charcoal-surface/80 border border-white/[0.06] rounded-2xl p-7 shadow-card backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center">
          <p className="text-white/35 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-gold hover:text-gold-hover transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
