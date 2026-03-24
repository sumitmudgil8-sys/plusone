"use client";
'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center p-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gold/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.95a9 9 0 01-1.853-5.95 9 9 0 011.853-5.95m0 0L9 8.464m0 0L6.293 5.757" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Offline</h1>

        <p className="text-white/60 mb-6">
          Please check your internet connection and try again.
        </p>

        <Button onClick={() => window.location.reload()} className="w-full">
          Try Again
        </Button>

        <Link href="/" className="block mt-4 text-gold hover:underline">
          Go to Home
        </Link>
      </Card>
    </div>
  );
}
