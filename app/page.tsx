import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '@/lib/auth';
import { SessionRestorer } from '@/components/SessionRestorer';

export default function HomePage() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  if (token) {
    const user = verifyJWT(token);
    if (user) {
      if (user.role === 'CLIENT') redirect('/client/dashboard');
      if (user.role === 'COMPANION') redirect('/companion/dashboard');
      if (user.role === 'ADMIN') redirect('/admin/dashboard');
    }
  }
  return (
    /*
     * Outer shell: full viewport, black bg (visible on desktop around the card).
     * Flex-center so the phone card sits in the middle on wide screens.
     */
    <main
      className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Silently restore session from localStorage refresh token (Samsung/Android cookie-clearing fix) */}
      <SessionRestorer />
      {/*
       * Phone card:
       *   – On mobile  : fills the entire screen (w-full h-full)
       *   – On desktop : fixed 390×844 "phone frame" centered on the black bg
       * No scrolling ever — everything must fit inside this box.
       */}
      <div className="relative w-full h-full md:w-[390px] md:h-[844px] md:rounded-[2.5rem] md:overflow-hidden md:shadow-[0_32px_80px_rgba(0,0,0,0.9)] flex flex-col bg-black">

        {/* ── HERO IMAGE — fixed 56% of the card height ── */}
        <div className="relative w-full flex-shrink-0" style={{ height: '56%' }}>
          <Image
            src="/hero.jpeg"
            alt="Plus One"
            fill
            priority
            className="object-cover object-top"
          />

          {/* Gradient: clear at top, fades to solid black at bottom */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.75) 75%, #000000 100%)',
            }}
          />

          {/* Wordmark */}
          <div className="absolute top-7 left-6">
            <span
              className="text-[0.6rem] font-semibold tracking-[0.35em] uppercase"
              style={{ color: '#C9A84C', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Plus One
            </span>
          </div>
        </div>

        {/* ── CONTENT — remaining 44%, flex column, no overflow ── */}
        <div
          className="flex-1 min-h-0 flex flex-col justify-between bg-black px-6 pt-5 pb-8"
        >
          {/* Headline + subtext */}
          <div>
            <h1
              className="font-bold leading-[1.08] tracking-tight text-white mb-2.5"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 'clamp(2rem, 8vw, 2.6rem)',
              }}
            >
              Find your<br />
              <span style={{ color: '#C9A84C' }}>perfect plus one.</span>
            </h1>
            <p className="text-white/45 leading-relaxed" style={{ fontSize: '0.875rem' }}>
              Sophisticated companionship for dinners,
              events, and every occasion that matters.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link href="/signup" className="w-full">
              <button
                className="w-full py-4 rounded-2xl text-black font-semibold tracking-wide transition-all duration-200 active:scale-95"
                style={{
                  fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #D4A84B 0%, #C9973A 100%)',
                  boxShadow: '0 4px 28px rgba(201,152,58,0.32)',
                }}
              >
                Get Started
              </button>
            </Link>

            <Link href="/login" className="w-full">
              <button
                className="w-full py-4 rounded-2xl text-white/75 font-medium tracking-wide transition-all duration-200 active:scale-95 border border-white/10 hover:border-white/20 hover:text-white"
                style={{
                  fontSize: '0.95rem',
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                Sign In
              </button>
            </Link>

            <p className="text-center text-white/20 tracking-widest mt-1" style={{ fontSize: '0.65rem' }}>
              VERIFIED · DISCREET · PREMIUM
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}