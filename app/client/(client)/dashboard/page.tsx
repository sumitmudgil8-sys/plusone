'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EXPERIENCE_CATEGORIES } from '@/lib/experiences';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ClientHome() {
  const [user, setUser] = useState<{ clientProfile?: { name?: string }; subscriptionStatus?: string } | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledSessions, setScheduledSessions] = useState<Array<{
    id: string; duration: number; scheduledAt: string; status: string;
    companionName: string; companionAvatar: string | null; holdAmount: number; estimatedTotal: number;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, walletRes, schedRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/wallet'),
          fetch('/api/scheduled-sessions?status=BOOKED'),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          if (walletData.success) setWalletBalance(walletData.data.balance);
        }
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          if (schedData.success) setScheduledSessions(schedData.data);
        }
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 pb-6 animate-pulse">
        <div className="rounded-2xl bg-white/[0.03] h-52" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="rounded-2xl bg-white/[0.03] h-20" />
      </div>
    );
  }

  const firstName = user?.clientProfile?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8 pb-6">

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gold-subtle" />
        <div className="absolute top-0 right-0 w-56 h-56 bg-gold/[0.06] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gold/[0.04] rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative px-5 pt-8 pb-6">
          <p className="text-white/35 text-sm font-medium tracking-wide">{getGreeting()}, {firstName}</p>
          <h1 className="text-[26px] font-bold text-white mt-2 leading-[1.2]">
            Want to go out but<br />
            <span className="text-gold-gradient">no one to join you?</span>
          </h1>
          <p className="text-white/30 text-[13px] mt-3 leading-relaxed max-w-[280px]">
            Pick an experience. We&apos;ll find a verified partner to go with you.
          </p>
          <Link
            href="/client/experiences"
            className="inline-flex items-center gap-2 mt-5 bg-gold text-charcoal text-[13px] font-bold px-6 py-3 rounded-full hover:bg-gold-hover active:scale-[0.97] transition-all shadow-gold-md"
          >
            Explore Experiences
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Experience Categories */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-white font-semibold text-[15px]">What do you want to do?</h2>
          <Link href="/client/experiences" className="text-gold/70 hover:text-gold text-xs font-medium transition-colors">
            See all &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {EXPERIENCE_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/client/experiences/${cat.id}`}
              className="group relative rounded-2xl p-4 border transition-all active:scale-[0.97] hover:brightness-110"
              style={{
                background: cat.color,
                borderColor: cat.borderColor,
              }}
            >
              <span className="text-3xl leading-none block mb-2.5">{cat.emoji}</span>
              <p className="text-white font-semibold text-[13px] leading-tight">{cat.label}</p>
              <p className="text-white/40 text-[11px] mt-1 leading-tight line-clamp-2">{cat.tagline}</p>
              <svg
                className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity"
                style={{ color: cat.textColor }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      {/* Wallet balance widget */}
      {walletBalance !== null && (
        <Link
          href="/client/wallet"
          className="flex items-center justify-between gap-3 rounded-2xl bg-charcoal-surface border border-white/[0.06] px-5 py-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Wallet balance</p>
              <p className="text-lg font-bold text-white mt-0.5">
                ₹{(walletBalance / 100).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gold font-semibold">
            {walletBalance < 20000 ? 'Add money' : 'Recharge'}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Upcoming Scheduled Sessions */}
      {scheduledSessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-white font-semibold text-[15px] flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upcoming Sessions
          </h2>
          {scheduledSessions.map((s) => {
            const dt = new Date(s.scheduledAt);
            const isNow = Math.abs(dt.getTime() - Date.now()) < 10 * 60 * 1000;
            return (
              <div key={s.id} className="rounded-xl bg-charcoal-surface border border-white/[0.06] px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-sm font-bold text-gold">
                  {s.duration}m
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">Chat with {s.companionName}</p>
                  <p className="text-xs text-white/40">
                    {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                    at {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {isNow ? (
                  <Link href={`/client/inbox/${s.id}?activate=true`}
                    className="shrink-0 bg-gold text-black text-[11px] font-bold px-3 py-1.5 rounded-full">
                    Start
                  </Link>
                ) : (
                  <span className="shrink-0 text-[10px] text-white/30 font-medium">
                    {dt > new Date() ? 'Upcoming' : 'Missed'}
                  </span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* How it works */}
      <section className="rounded-2xl bg-charcoal-surface border border-white/[0.06] p-5 space-y-4">
        <h2 className="text-white font-semibold text-[14px]">How Plus One works</h2>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Pick an experience', desc: 'Choose from dining, art, music, outdoor and more' },
            { step: '2', title: 'Select a Plus One', desc: 'Browse verified partners available for your activity' },
            { step: '3', title: 'Go & enjoy', desc: 'Meet up and have a great time — pay per minute' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-gold text-[11px] font-bold">{item.step}</span>
              </div>
              <div>
                <p className="text-white text-[13px] font-medium">{item.title}</p>
                <p className="text-white/40 text-[11px] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="pt-2">
        <div className="flex items-center justify-center gap-8 py-5 border-t border-white/[0.04]">
          <TrustItem icon="shield" label="Verified Partners" />
          <TrustItem icon="lock" label="Secure Payments" />
          <TrustItem icon="support" label="24/7 Support" />
        </div>
      </section>
    </div>
  );
}

function TrustItem({ icon, label }: { icon: 'shield' | 'lock' | 'support'; label: string }) {
  const icons = {
    shield: <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />,
    lock: <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />,
    support: <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />,
  };

  return (
    <div className="flex items-center gap-2">
      <svg className="w-3.5 h-3.5 text-gold/40" viewBox="0 0 20 20" fill="currentColor">
        {icons[icon]}
      </svg>
      <span className="text-white/20 text-[10px] font-medium tracking-wide">{label}</span>
    </div>
  );
}
