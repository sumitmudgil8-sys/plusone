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
      if (user.role === 'CLIENT') {
        if (user.clientStatus === 'PENDING_REVIEW') redirect('/client/pending');
        else if (user.clientStatus === 'REJECTED') redirect('/client/rejected');
        else redirect('/client/dashboard');
      }
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

        {/* ── CONTENT — remaining 44%, flex column ── */}
        <div className="flex-1 min-h-0 flex flex-col justify-between bg-black px-6 pt-5 pb-8">

          {/* Headline + subtext */}
          <div className="space-y-3">
            <h1
              className="font-bold leading-[1.08] tracking-tight text-white"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 'clamp(2rem, 8vw, 2.6rem)',
              }}
            >
              Find the right<br />
              <span style={{ color: '#C9A84C' }}>company. Effortlessly.</span>
            </h1>

            <p className="text-white/50 leading-snug" style={{ fontSize: '0.85rem' }}>
              A private network of verified companions for dinners, events, and travel.
            </p>

            <p className="text-white/30" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Verified&nbsp;&nbsp;•&nbsp;&nbsp;Pre-chat&nbsp;&nbsp;•&nbsp;&nbsp;Pay for time
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Link href="/signup" className="block w-full">
              <button
                className="w-full py-[14px] rounded-2xl text-black font-semibold tracking-wide transition-all duration-200 active:scale-95"
                style={{
                  fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #D4A84B 0%, #C9973A 100%)',
                  boxShadow: '0 4px 28px rgba(201,152,58,0.32)',
                }}
              >
                Request Access
              </button>
            </Link>

            <p className="text-center text-white/25" style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              Members only. Curated. Discreet.
            </p>

            <p className="text-center" style={{ fontSize: '0.8rem' }}>
              <span className="text-white/30">Already a member?</span>{' '}
              <Link href="/login" className="font-medium transition-colors" style={{ color: '#C9A84C' }}>
                Sign in →
              </Link>
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}