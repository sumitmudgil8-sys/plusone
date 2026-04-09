'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Invisible component rendered on the landing page when no auth cookie is
// present. Checks localStorage for a refresh token (written after login),
// silently exchanges it for a fresh cookie, then redirects to the dashboard.
// Solves Samsung / Android aggressive cookie clearing without user interaction.
export function SessionRestorer() {
  const router = useRouter();

  useEffect(() => {
    const rt = localStorage.getItem('_pone_rt');
    if (!rt) return;

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user?.role) {
          // Update the stored refresh token to the newly issued one
          if (d.refreshToken) localStorage.setItem('_pone_rt', d.refreshToken);

          switch (d.user.role) {
            case 'CLIENT':    router.replace('/client/dashboard');    break;
            case 'COMPANION': router.replace('/companion/dashboard'); break;
            case 'ADMIN':     router.replace('/admin/dashboard');     break;
          }
        } else {
          // Refresh token rejected — remove stale entry
          localStorage.removeItem('_pone_rt');
        }
      })
      .catch(() => {
        // Network error — leave the token for the next attempt
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
