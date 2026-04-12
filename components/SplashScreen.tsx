'use client';

import { useEffect, useState } from 'react';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'splash' | 'fading' | 'done'>('splash');

  useEffect(() => {
    // Check if splash was already shown this session
    if (sessionStorage.getItem('splash_shown')) {
      setPhase('done');
      return;
    }

    const fadeTimer = setTimeout(() => setPhase('fading'), 2200);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      sessionStorage.setItem('splash_shown', '1');
    }, 2900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <>
      {/* Render children once — hidden during splash, visible when done */}
      <div style={phase !== 'done' ? { visibility: 'hidden', position: 'fixed', inset: 0, overflow: 'hidden' } : undefined}>
        {children}
      </div>

      {/* Splash overlay */}
      {phase !== 'done' && <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-700 ${
          phase === 'fading' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* Ambient glow orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="splash-orb splash-orb-1" />
          <div className="splash-orb splash-orb-2" />
          <div className="splash-orb splash-orb-3" />
        </div>

        {/* Radial vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 45%, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        {/* Center content */}
        <div className="relative flex flex-col items-center gap-8">
          {/* Animated ring */}
          <div className="splash-ring-container">
            <svg className="splash-ring" viewBox="0 0 120 120" width="120" height="120">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="1" />
                  <stop offset="50%" stopColor="#E8D5A3" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="1.5"
                className="splash-ring-circle"
              />
            </svg>

            {/* Inner "+" mark */}
            <div className="absolute inset-0 flex items-center justify-center splash-plus">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <line x1="18" y1="6" x2="18" y2="30" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="18" x2="30" y2="18" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Wordmark */}
          <div className="splash-wordmark flex flex-col items-center gap-1">
            <h1
              className="text-[2rem] font-bold tracking-tight text-white"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic' }}
            >
              Plus <span style={{ color: '#C9A84C' }}>One</span>
            </h1>
            <p
              className="text-[0.6rem] font-semibold tracking-[0.4em] uppercase text-white/25"
            >
              Premium Companionship
            </p>
          </div>

          {/* Shimmer line */}
          <div className="splash-shimmer-track">
            <div className="splash-shimmer" />
          </div>
        </div>
      </div>}
    </>
  );
}
