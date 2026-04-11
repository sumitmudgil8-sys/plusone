import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#0B0B0B',
          surface: '#141414',
          elevated: '#1C1C1C',
          border: '#ffffff0f',
          'border-strong': '#ffffff1a',
        },
        gold: {
          DEFAULT: '#C9A96E',
          hover: '#D4B87A',
          bright: '#D4AF37',
          muted: '#C9A96E99',
        },
        // Semantic status tokens — use these instead of raw emerald/red/amber
        // classes so the palette is centralized and themeable. `text-success`,
        // `bg-error`, etc. are referenced across the app; do not remove.
        success: {
          DEFAULT: '#10b981',
          fg: '#34d399',      // lighter for text on dark bg
        },
        error: {
          DEFAULT: '#ef4444',
          fg: '#f87171',
        },
        warning: {
          DEFAULT: '#f59e0b',
          fg: '#fbbf24',
        },
        info: {
          DEFAULT: '#3b82f6',
          fg: '#60a5fa',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-gold': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A96E, #D4B87A, #C9A96E)',
        'gold-subtle': 'linear-gradient(135deg, rgba(201,169,110,0.08), rgba(201,169,110,0.03))',
        'surface-gradient': 'linear-gradient(180deg, #141414, #0B0B0B)',
      },
      boxShadow: {
        'gold-sm': '0 2px 8px rgba(201,169,110,0.08)',
        'gold-md': '0 4px 16px rgba(201,169,110,0.12)',
        'gold-lg': '0 8px 32px rgba(201,169,110,0.16)',
        'gold-glow': '0 0 24px rgba(201,169,110,0.15)',
        'inner-light': 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'card': '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}

export default config
