import type { Metadata, Viewport } from 'next';
import './globals.css';

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
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192' },
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
  themeColor: '#C9A84C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-charcoal text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
