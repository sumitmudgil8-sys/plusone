import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SplashScreen } from '@/components/SplashScreen';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: {
    default: 'Plus One - Premium Social Companionship',
    template: '%s | Plus One',
  },
  description: 'Connect with sophisticated companions for events, dinners, and social occasions. Discreet, safe, and premium companion booking platform.',
  keywords: ['companion', 'booking', 'events', 'social', 'premium', 'escort', 'dinner date', 'plus one'],
  authors: [{ name: 'Plus One' }],
  creator: 'Plus One',
  publisher: 'Plus One',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: 'Plus One',
    title: 'Plus One - Premium Social Companionship',
    description: 'Connect with sophisticated companions for events, dinners, and social occasions.',
    images: [
      {
        url: `${baseUrl}/icons/icon-512.png`,
        width: 512,
        height: 512,
        alt: 'Plus One Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plus One - Premium Social Companionship',
    description: 'Connect with sophisticated companions for events, dinners, and social occasions.',
    images: [`${baseUrl}/icons/icon-512.png`],
  },
  verification: {
    // Add your verification tokens here
    // google: 'google-site-verification-code',
  },
  alternates: {
    canonical: baseUrl,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
      { url: '/icons/apple-touch-icon-152.png', sizes: '152x152' },
      { url: '/icons/apple-touch-icon-167.png', sizes: '167x167' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Plus One',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0B0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-charcoal text-white min-h-screen">
        <SplashScreen>{children}</SplashScreen>
      </body>
    </html>
  );
}
