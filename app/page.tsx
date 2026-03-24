import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full bg-black flex flex-col overflow-hidden">

      {/* ── Hero Image (top 65%) ── */}
      <div className="relative w-full" style={{ height: '65svh' }}>
        <Image
          src="/hero.jpeg"
          alt="Plus One hero"
          fill
          priority
          className="object-cover object-center"
        />

        {/* Multi-stop gradient: transparent top → rich black bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.72) 78%, #000 100%)',
          }}
        />

        {/* Logo mark – top-left */}
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <span
            className="text-xs font-semibold tracking-[0.25em] uppercase"
            style={{ color: '#C9A84C', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Plus One
          </span>
        </div>
      </div>

      {/* ── Content card – floats over the gradient tail ── */}
      <div
        className="relative z-10 flex flex-col flex-1 px-6 pt-8 pb-12"
        style={{ marginTop: '-3.5rem' }}
      >
        {/* Brand + Tagline */}
        <div className="mb-10">
          <h1
            className="text-5xl font-bold leading-[1.08] tracking-tight text-white mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic' }}
          >
            Find your
            <br />
            <span style={{ color: '#C9A84C' }}>perfect plus one.</span>
          </h1>
          <p
            className="text-white/50 text-[0.95rem] leading-relaxed max-w-xs"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Sophisticated companionship for dinners, events, and every occasion that matters.
          </p>
        </div>

        {/* Spacer so buttons pin to bottom on short screens */}
        <div className="flex-1" />

        {/* ── CTAs ── */}
        <div className="flex flex-col gap-3 w-full">
          <Link href="/signup" className="w-full">
            <button
              className="w-full py-4 rounded-2xl text-black font-semibold text-[1rem] tracking-wide transition-all duration-200 active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #D4A84B 0%, #C9973A 100%)',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 4px 32px rgba(201,152,58,0.35)',
              }}
            >
              Get Started
            </button>
          </Link>

          <Link href="/login" className="w-full">
            <button
              className="w-full py-4 rounded-2xl text-white/80 font-medium text-[1rem] tracking-wide transition-all duration-200 active:scale-[0.97] border border-white/12 hover:border-white/20 hover:text-white"
              style={{
                background: 'rgba(255,255,255,0.05)',
                fontFamily: "'DM Sans', sans-serif",
                backdropFilter: 'blur(12px)',
              }}
            >
              Sign In
            </button>
          </Link>
        </div>

        {/* Footnote */}
        <p
          className="text-center text-white/25 text-[0.72rem] tracking-wide mt-6"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Verified profiles · Discreet · Premium
        </p>
      </div>
    </main>
  );
}
