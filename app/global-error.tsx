"use client";
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html>
      <head>
        <title>Error - Plus One</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-charcoal text-white min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-error/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
          <p className="text-white/60 mb-8">
            A critical error has occurred. We apologize for the inconvenience.
          </p>

          <button
            onClick={reset}
            className="px-6 py-3 bg-gold text-charcoal rounded-lg font-semibold hover:bg-gold/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
