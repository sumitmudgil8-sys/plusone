'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CompanionChatRedirect() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voiceSessionId = params.get('voiceSessionId');
    const url = `/companion/inbox?active=${clientId}${voiceSessionId ? `&voiceSessionId=${voiceSessionId}` : ''}`;
    router.replace(url);
  }, [clientId, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
    </div>
  );
}
